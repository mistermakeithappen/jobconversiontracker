import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { GHLClient } from '@/lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    // Get auth without subscription requirement for contact sync
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Get organization's GHL integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      return NextResponse.json(
        { error: 'No active GoHighLevel integration found' },
        { status: 404 }
      );
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('contact_sync_logs')
      .insert({
        organization_id: organization.organizationId,
        integration_id: integration.id,
        sync_type: 'full',
        status: 'started'
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create sync log:', logError);
    }

    // Start the sync in the background
    syncContactsInBackground(userId, integration, syncLog?.id);

    return NextResponse.json({
      success: true,
      message: 'Contact sync started',
      syncLogId: syncLog?.id
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
}

async function syncContactsInBackground(
  userId: string,
  integration: any,
  syncLogId?: string
) {
  const supabase = getServiceSupabase();
  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Get organization context
    const organization = await getUserOrganization(userId);
    if (!organization) {
      throw new Error('No organization found for user');
    }
    // Decrypt tokens from config.encryptedTokens
    if (!integration.config?.encryptedTokens) {
      throw new Error('No encrypted tokens found in integration');
    }

    const decryptedTokens = decrypt(integration.config.encryptedTokens);
    const tokens = JSON.parse(decryptedTokens);
    // Handle both camelCase and snake_case token formats
    const accessToken = tokens.accessToken || tokens.access_token;
    const refreshToken = tokens.refreshToken || tokens.refresh_token;

    // Create GHL client with token refresh callback
    const client = new GHLClient({
      accessToken,
      refreshToken,
      expiresAt: tokens.expiresAt || integration.expires_at || new Date(Date.now() + 3600000).toISOString(),
      locationId: integration.config.locationId,
      companyId: integration.config.companyId,
      userId: tokens.userId || integration.config.userId
    }, async (newTokens) => {
      // Update tokens in database if refreshed
      const encryptedAccess = encrypt(newTokens.accessToken);
      const encryptedRefresh = encrypt(newTokens.refreshToken);
      
      await supabase
        .from('integrations')
        .update({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          expires_at: newTokens.expiresAt
        })
        .eq('id', integration.id);
    });

    // IMPORTANT: Using direct REST API for contact sync - MCP is not suitable for bulk operations
    console.log('📌 Using direct REST API for contact sync');
    console.log(`🔄 Starting contact sync for location ${integration.config.locationId}`);

    // Get ALL existing contacts to track what needs updating and what should be deleted
    // Include origin field to identify locally-created contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, ghl_contact_id, ghl_updated_at, origin, phone, email')
      .eq('integration_id', integration.id)
      .eq('sync_status', 'synced');

    const existingMap = new Map(
      existingContacts?.map(c => [c.ghl_contact_id, c]) || []
    );
    
    // Track which contacts we've seen during sync (for deletion tracking)
    const seenContactIds = new Set<string>();

    // Fetch contacts in batches - continue until no more contacts
    let hasMore = true;
    let startAfterId: string | undefined;
    let startAfter: number | undefined;
    let batchNumber = 0;
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastBatchFirstId: string | undefined;  // Track to detect if we're stuck
    
    while (hasMore) {
      try {
        batchNumber++;
        console.log(`🔄 Fetching batch ${batchNumber} (startAfterId: ${startAfterId || 'none'})`);
        
        // Use dedicated sync method that bypasses MCP entirely
        const response = await client.getContactsForSync({
          limit: 100,
          startAfterId,
          startAfter
        });

        // Handle both array response and object with contacts property
        const batch = Array.isArray(response) ? response : response?.contacts;
        const meta = response?.meta;

        if (!batch || !Array.isArray(batch) || batch.length === 0) {
          console.log('📍 Empty batch received - sync complete');
          hasMore = false;
          break;
        }
        
        // Check if we're stuck in a loop (getting the same batch)
        if (batch.length > 0 && lastBatchFirstId === batch[0].id) {
          console.log('⚠️ Detected pagination loop - stopping sync');
          hasMore = false;
          break;
        }
        lastBatchFirstId = batch[0].id;

        console.log(`📦 Processing batch ${batchNumber}: ${batch.length} contacts`);
        if (meta) {
          console.log(`   Pagination: startAfterId=${meta.startAfterId || 'none'}, total=${meta.total || 'unknown'}`);
        }
        
        // Log first contact to see structure (only once)
        if (batchNumber === 1 && batch.length > 0) {
          console.log('Sample contact structure:', JSON.stringify(batch[0], null, 2));
        }

        // Process each contact
        for (const contact of batch) {
          processed++;
          
          try {
            // Track that we've seen this contact
            seenContactIds.add(contact.id);
            
            const isNew = !existingMap.has(contact.id);
            
            // Extract name from various possible fields
            const firstName = contact.firstName || contact.firstNameRaw || contact.first_name || '';
            const lastName = contact.lastName || contact.lastNameRaw || contact.last_name || '';
            const fullName = contact.contactName || contact.name || contact.full_name || 
                           `${firstName} ${lastName}`.trim() || 
                           contact.email || contact.phone || 'Unknown';
            
            const contactData = {
              organization_id: organization.organizationId,
              integration_id: integration.id,
              ghl_contact_id: contact.id,
              ghl_location_id: integration.config.locationId,
              first_name: firstName,
              last_name: lastName,
              full_name: fullName,
              email: contact.email,
              phone: contact.phone,
              company_name: contact.companyName,
              address1: contact.address1,
              city: contact.city,
              state: contact.state,
              postal_code: contact.postalCode,
              country: contact.country,
              tags: contact.tags || [],
              custom_fields: contact.customFields || {},
              source: contact.source,
              sync_status: 'synced',
              origin: 'ghl',  // Mark as coming from GoHighLevel
              needs_ghl_sync: false,  // Already in GHL, doesn't need sync
              raw_data: contact,
              ghl_created_at: contact.dateAdded,
              ghl_updated_at: contact.dateUpdated
            };

            // Upsert using the unique constraint (integration_id, ghl_contact_id)
            const { data: upsertData, error } = await supabase
              .from('contacts')
              .upsert(contactData, {
                onConflict: 'integration_id,ghl_contact_id'
              })
              .select();

            if (error) {
              console.error(`Failed to sync contact ${contact.id}:`, error.message || error);
              errors++;
            } else {
              if (isNew) created++;
              else updated++;
            }

            // Log progress every 100 contacts
            if (processed % 100 === 0) {
              console.log(`✅ Progress: ${processed} processed, ${created} created, ${updated} updated`);
            }

          } catch (contactError) {
            console.error(`Error processing contact ${contact.id}:`, contactError);
            errors++;
          }
        }

        // Set up for next batch - ALWAYS use the last contact's ID for pagination
        if (batch.length > 0) {
          // Always use the last contact's ID for pagination
          const lastContact = batch[batch.length - 1];
          startAfterId = lastContact.id;
          startAfter = undefined;
          
          console.log(`   Next batch will start after contact ID: ${startAfterId}`);
          
          // Continue fetching - we'll stop when we get an empty batch
          hasMore = true;
          retryCount = 0; // Reset retry count on successful batch
        } else {
          // No more contacts to fetch
          console.log('📍 No more contacts to fetch - sync complete');
          hasMore = false;
        }

      } catch (batchError) {
        console.error(`Error fetching batch ${batchNumber}:`, batchError);
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
          console.log(`⚠️ Retrying batch ${batchNumber} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        } else {
          console.error(`❌ Max retries reached for batch ${batchNumber}, stopping sync`);
          hasMore = false;
        }
      }
    }

    // Handle contacts that no longer exist in GHL
    console.log('🧹 Checking for deleted contacts...');
    const contactsToDelete = [];
    const contactsToSync = [];
    let deletedCount = 0;
    let localContactsFound = 0;
    
    // Find contacts that exist in our DB but weren't seen in the sync
    for (const [ghlContactId, existingContact] of existingMap) {
      if (!seenContactIds.has(ghlContactId)) {
        // Check if this is a locally-created contact
        if (existingContact.origin === 'local' || existingContact.origin === 'manual') {
          // This is a local contact that needs to be synced TO GHL
          contactsToSync.push({
            id: existingContact.id,
            phone: existingContact.phone,
            email: existingContact.email
          });
          localContactsFound++;
        } else if (existingContact.origin === 'ghl' || !existingContact.origin) {
          // This was synced from GHL but no longer exists there - safe to delete
          contactsToDelete.push(existingContact.id);
        }
      }
    }
    
    // Mark local contacts for sync to GHL
    if (contactsToSync.length > 0) {
      console.log(`📤 Found ${contactsToSync.length} locally-created contacts that need to be synced to GHL`);
      
      // Mark these contacts as needing sync
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ needs_ghl_sync: true })
        .in('id', contactsToSync.map(c => c.id));
      
      if (updateError) {
        console.error('Error marking contacts for GHL sync:', updateError);
      } else {
        console.log(`✅ Marked ${contactsToSync.length} local contacts for future sync to GHL`);
      }
    }
    
    // Delete only GHL-origin contacts that no longer exist
    if (contactsToDelete.length > 0) {
      console.log(`🗑️ Found ${contactsToDelete.length} GHL contacts to delete (no longer exist in GHL)`);
      
      // Delete in batches of 100
      for (let i = 0; i < contactsToDelete.length; i += 100) {
        const batch = contactsToDelete.slice(i, i + 100);
        const { error: deleteError } = await supabase
          .from('contacts')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.error('Error deleting contacts:', deleteError);
        } else {
          deletedCount += batch.length;
        }
      }
      
      console.log(`✅ Deleted ${deletedCount} GHL contacts that no longer exist in GHL`);
    } else {
      console.log('✅ No GHL contacts to delete');
    }
    
    if (localContactsFound > 0) {
      console.log(`ℹ️ Preserved ${localContactsFound} locally-created contacts`);
    }

    // Update sync log
    if (syncLogId) {
      await supabase
        .from('contact_sync_logs')
        .update({
          status: 'completed',
          total_contacts: processed,
          synced_contacts: created + updated,
          failed_contacts: errors,
          deleted_contacts: deletedCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId);
    }

    console.log(`✅ Sync completed successfully!`);
    console.log(`📊 Final stats:`);
    console.log(`   - Total contacts processed: ${processed}`);
    console.log(`   - New contacts created: ${created}`);
    console.log(`   - Existing contacts updated: ${updated}`);
    console.log(`   - GHL contacts deleted (no longer in GHL): ${deletedCount}`);
    console.log(`   - Local contacts preserved: ${localContactsFound}`);
    console.log(`   - Local contacts marked for GHL sync: ${contactsToSync.length}`);
    console.log(`   - Errors encountered: ${errors}`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
    
    // Update sync log with error
    if (syncLogId) {
      await supabase
        .from('contact_sync_logs')
        .update({
          status: 'failed',
          total_contacts: processed,
          synced_contacts: created + updated,
          failed_contacts: errors,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_details: error instanceof Error ? { stack: error.stack } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId);
    }
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    // Get auth without subscription requirement for sync status check
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    const syncLogId = request.nextUrl.searchParams.get('syncLogId');
    
    if (syncLogId) {
      // Get specific sync log - sync logs might be per integration, not user
      const { data, error } = await supabase
        .from('contact_sync_logs')
        .select('*')
        .eq('id', syncLogId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Sync log not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    } else {
      // Get organization's GHL integration first
      const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('organization_id', organization.organizationId)
        .eq('type', 'gohighlevel')
        .eq('is_active', true)
        .single();
        
      if (!integration) {
        return NextResponse.json({ error: 'No active GoHighLevel integration found' }, { status: 404 });
      }
      
      // Get recent sync logs for this integration
      const { data, error } = await supabase
        .from('contact_sync_logs')
        .select('*')
        .eq('integration_id', integration.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}