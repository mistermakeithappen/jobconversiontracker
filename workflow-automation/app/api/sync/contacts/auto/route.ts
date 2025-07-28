import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // This endpoint syncs contacts for all users - can be called by a cron job
    console.log('Starting automatic contact sync for all integrations...');
    
    // Get all active GHL integrations
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .eq('status', 'active');
    
    if (error) {
      console.error('Error fetching integrations:', error);
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
    }
    
    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ 
        message: 'No active GoHighLevel integrations found',
        syncedIntegrations: 0
      });
    }
    
    const syncResults = [];
    
    for (const integration of integrations) {
      try {
        console.log(`Syncing contacts for integration ${integration.id} (user: ${integration.user_id})`);
        
        // Check if there's already a running sync job for this integration
        const { data: runningSyncs } = await supabase
          .from('contact_sync_jobs')
          .select('*')
          .eq('integration_id', integration.id)
          .eq('status', 'running')
          .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes
        
        if (runningSyncs && runningSyncs.length > 0) {
          console.log(`Skipping integration ${integration.id} - sync already running`);
          syncResults.push({
            integrationId: integration.id,
            userId: integration.user_id,
            status: 'skipped',
            reason: 'sync_already_running'
          });
          continue;
        }
        
        // Create sync job record
        const { data: syncJob, error: jobError } = await supabase
          .from('contact_sync_jobs')
          .insert({
            user_id: integration.user_id,
            integration_id: integration.id,
            status: 'running',
            started_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (jobError) {
          console.error(`Error creating sync job for integration ${integration.id}:`, jobError);
          syncResults.push({
            integrationId: integration.id,
            userId: integration.user_id,
            status: 'error',
            error: 'Failed to create sync job'
          });
          continue;
        }
        
        try {
          // Create GHL client with token refresh callback
          const ghlClient = await createGHLClient(
            integration.config.encryptedTokens,
            async (newTokens) => {
              const encryptedTokens = encrypt(JSON.stringify(newTokens));
              await supabase
                .from('integrations')
                .update({
                  config: {
                    ...integration.config,
                    encryptedTokens,
                    lastTokenRefresh: new Date().toISOString()
                  }
                })
                .eq('id', integration.id);
            }
          );
          
          // Fetch ALL contacts using pagination
          const contactsResponse = await ghlClient.getAllContacts({
            locationId: integration.config.locationId,
            maxResults: 5000 // Reasonable limit for auto sync
          });
          
          if (!contactsResponse.contacts || contactsResponse.contacts.length === 0) {
            await supabase
              .from('contact_sync_jobs')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                contacts_fetched: 0,
                contacts_created: 0,
                contacts_updated: 0
              })
              .eq('id', syncJob.id);
            
            syncResults.push({
              integrationId: integration.id,
              userId: integration.user_id,
              status: 'completed',
              contactsFetched: 0,
              contactsCreated: 0,
              contactsUpdated: 0
            });
            continue;
          }
          
          let contactsCreated = 0;
          let contactsUpdated = 0;
          
          // Process contacts in smaller batches for auto sync
          const batchSize = 50;
          const contacts = contactsResponse.contacts;
          
          for (let i = 0; i < contacts.length; i += batchSize) {
            const batch = contacts.slice(i, i + batchSize);
            
            for (const contact of batch) {
              const contactData = {
                user_id: integration.user_id,
                integration_id: integration.id,
                ghl_contact_id: contact.id,
                ghl_location_id: integration.config.locationId,
                first_name: contact.firstName || null,
                last_name: contact.lastName || null,
                full_name: contact.fullNameLowerCase || 
                         `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                         contact.email || 
                         'Unknown Contact',
                email: contact.email || null,
                phone: contact.phone || null,
                tags: contact.tags || [],
                status: contact.status || null,
                source: contact.source || null,
                date_added: contact.dateAdded ? new Date(contact.dateAdded).toISOString() : null,
                date_updated: contact.dateUpdated ? new Date(contact.dateUpdated).toISOString() : null,
                synced_at: new Date().toISOString()
              };
              
              // Check if contact exists
              const { data: existingContact } = await supabase
                .from('synced_contacts')
                .select('id, created_at')
                .eq('integration_id', integration.id)
                .eq('ghl_contact_id', contact.id)
                .single();
              
              // Upsert contact
              const { error: upsertError } = await supabase
                .from('synced_contacts')
                .upsert(contactData, { 
                  onConflict: 'integration_id,ghl_contact_id',
                  ignoreDuplicates: false 
                });
              
              if (upsertError) {
                console.error('Error upserting contact in auto sync:', upsertError);
                continue;
              }
              
              if (existingContact) {
                contactsUpdated++;
              } else {
                contactsCreated++;
              }
            }
            
            // Small delay between batches
            if (i + batchSize < contacts.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          
          // Update sync job with results
          await supabase
            .from('contact_sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              contacts_fetched: contacts.length,
              contacts_created: contactsCreated,
              contacts_updated: contactsUpdated
            })
            .eq('id', syncJob.id);
          
          syncResults.push({
            integrationId: integration.id,
            userId: integration.user_id,
            status: 'completed',
            contactsFetched: contacts.length,
            contactsCreated,
            contactsUpdated,
            requestCount: contactsResponse.requestCount
          });
          
          console.log(`Auto sync completed for integration ${integration.id}: ${contacts.length} fetched, ${contactsCreated} created, ${contactsUpdated} updated`);
          
        } catch (syncError: any) {
          console.error(`Contact sync error for integration ${integration.id}:`, syncError);
          
          // Update sync job with error
          await supabase
            .from('contact_sync_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: syncError.message || 'Unknown error during auto sync'
            })
            .eq('id', syncJob.id);
          
          syncResults.push({
            integrationId: integration.id,
            userId: integration.user_id,
            status: 'error',
            error: syncError.message
          });
        }
        
      } catch (integrationError: any) {
        console.error(`Error processing integration ${integration.id}:`, integrationError);
        syncResults.push({
          integrationId: integration.id,
          userId: integration.user_id,
          status: 'error',
          error: integrationError.message
        });
      }
      
      // Small delay between integrations to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Auto contact sync completed for all integrations');
    
    return NextResponse.json({
      success: true,
      totalIntegrations: integrations.length,
      syncResults,
      summary: {
        completed: syncResults.filter(r => r.status === 'completed').length,
        skipped: syncResults.filter(r => r.status === 'skipped').length,
        errors: syncResults.filter(r => r.status === 'error').length
      }
    });
    
  } catch (error: any) {
    console.error('Error in auto contact sync:', error);
    return NextResponse.json({ 
      error: 'Auto sync failed',
      details: error.message 
    }, { status: 500 });
  }
}