import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const { integrationId } = await request.json();
    
    // Get user's GHL integration
    let { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('id', integrationId || '')
      .single();
    
    if (error || !integration || !integration.config.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel integration not found' }, { status: 400 });
    }
    
    // Create sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('contact_sync_jobs')
      .insert({
        user_id: userId,
        integration_id: integration.id,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (jobError) {
      console.error('Error creating sync job:', jobError);
      return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 });
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
      console.log('Fetching all contacts from GHL...');
      const contactsResponse = await ghlClient.getAllContacts({
        locationId: integration.config.locationId,
        maxResults: 10000 // Reasonable limit
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
        
        return NextResponse.json({
          success: true,
          message: 'No contacts found to sync',
          contactsFetched: 0,
          contactsCreated: 0,
          contactsUpdated: 0
        });
      }
      
      let contactsCreated = 0;
      let contactsUpdated = 0;
      
      // Process contacts in batches to avoid overwhelming the database
      const batchSize = 100;
      const contacts = contactsResponse.contacts;
      
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        for (const contact of batch) {
          const contactData = {
            user_id: userId,
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
          
          // Upsert contact (insert or update if exists)
          const { data: upsertedContact, error: upsertError } = await supabase
            .from('synced_contacts')
            .upsert(contactData, { 
              onConflict: 'integration_id,ghl_contact_id',
              ignoreDuplicates: false 
            })
            .select()
            .single();
          
          if (upsertError) {
            console.error('Error upserting contact:', upsertError, contactData);
            continue;
          }
          
          // Check if this was an insert or update
          const { data: existingContact } = await supabase
            .from('synced_contacts')
            .select('created_at')
            .eq('id', upsertedContact.id)
            .single();
          
          if (existingContact) {
            const isNew = new Date(existingContact.created_at).getTime() === new Date(upsertedContact.created_at).getTime();
            if (isNew) {
              contactsCreated++;
            } else {
              contactsUpdated++;
            }
          }
        }
        
        // Small delay between batches to be nice to the database
        if (i + batchSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
      
      console.log(`Contact sync completed: ${contacts.length} fetched, ${contactsCreated} created, ${contactsUpdated} updated`);
      
      return NextResponse.json({
        success: true,
        contactsFetched: contacts.length,
        contactsCreated,
        contactsUpdated,
        requestCount: contactsResponse.requestCount
      });
      
    } catch (syncError: any) {
      console.error('Contact sync error:', syncError);
      
      // Update sync job with error
      await supabase
        .from('contact_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: syncError.message || 'Unknown error during sync'
        })
        .eq('id', syncJob.id);
      
      return NextResponse.json({ 
        error: 'Contact sync failed',
        details: syncError.message 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in contact sync endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get('integrationId');
    
    // Get latest sync jobs
    const { data: syncJobs, error } = await supabase
      .from('contact_sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integrationId || '')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching sync jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
    }
    
    // Get contact counts
    const { data: contactCounts, error: countError } = await supabase
      .from('synced_contacts')
      .select('ghl_location_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('integration_id', integrationId || '');
    
    const totalContacts = contactCounts?.length || 0;
    
    return NextResponse.json({
      syncJobs: syncJobs || [],
      totalContacts,
      latestSync: syncJobs?.[0] || null
    });
    
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}