import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { GHLClient } from '@/lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function POST(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
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

    // Don't use MCP for contact sync as it doesn't support proper pagination
    // MCP returns only 20 contacts at a time without proper pagination support
    console.log('📌 Using REST API for contact sync (MCP pagination not supported)');

    console.log(`🔄 Starting contact sync for location ${integration.config.locationId}`);

    // Get existing contacts to determine what needs updating
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('ghl_contact_id, ghl_updated_at')
      .eq('integration_id', integration.id)
      .eq('sync_status', 'synced');

    const existingMap = new Map(
      existingContacts?.map(c => [c.ghl_contact_id, c.ghl_updated_at]) || []
    );

    // Fetch contacts in batches
    let hasMore = true;
    let startAfterId: string | undefined;
    let startAfter: number | undefined;
    
    while (hasMore) {
      try {
        const response = await client.getContacts({
          limit: 100,
          startAfterId,
          startAfter
        });

        // Handle both array response and object with contacts property
        const batch = Array.isArray(response) ? response : response?.contacts;
        const meta = response?.meta;

        if (!batch || !Array.isArray(batch) || batch.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`📦 Processing batch of ${batch.length} contacts...`);
        console.log(`   Meta info:`, meta ? { 
          total: meta.total, 
          currentPage: meta.currentPage, 
          nextPage: meta.nextPage,
          startAfterId: meta.startAfterId,
          startAfter: meta.startAfter 
        } : 'No meta data');

        // Process each contact
        for (const contact of batch) {
          processed++;
          
          try {
            const isNew = !existingMap.has(contact.id);
            
            const contactData = {
              organization_id: organization.organizationId,
              integration_id: integration.id,
              ghl_contact_id: contact.id,
              ghl_location_id: integration.config.locationId,
              first_name: contact.firstName || contact.firstNameRaw,
              last_name: contact.lastName || contact.lastNameRaw,
              full_name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
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
              raw_data: contact,
              ghl_created_at: contact.dateAdded,
              ghl_updated_at: contact.dateUpdated
            };

            const { data: upsertData, error } = await supabase
              .from('contacts')
              .upsert(contactData)
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

        // Set up for next batch using meta information if available
        if (meta?.startAfterId && meta?.startAfter) {
          startAfterId = meta.startAfterId;
          startAfter = meta.startAfter;
        } else {
          // Fallback to old method if no meta
          startAfterId = batch[batch.length - 1].id;
          startAfter = undefined;
        }
        
        // Check if there are more pages
        if (meta?.nextPage === null || batch.length < 100) {
          hasMore = false;
        }

      } catch (batchError) {
        console.error('Error fetching batch:', batchError);
        hasMore = false;
      }
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
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLogId);
    }

    console.log(`✅ Sync completed: ${processed} contacts processed (${created} new, ${updated} updated)`);

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
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
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