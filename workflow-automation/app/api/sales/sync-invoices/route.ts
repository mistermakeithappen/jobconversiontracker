import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/sales/sync-invoices - Starting invoice sync request');
    
    // Get user from production auth
    const { userId } = await requireAuth(request);
    
    console.log('User authenticated:', userId);

    // Get organization for the user
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    
    // Get integration ID from request
    const { integrationId } = await request.json();
    
    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    // Get the integration with tokens
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return NextResponse.json({ error: 'GoHighLevel integration not found or not active' }, { status: 404 });
    }

    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel integration not properly connected' }, { status: 400 });
    }

    // Create GHL client with proper token refresh callback
    const { decrypt, encrypt } = await import('@/lib/utils/encryption');
    const mcpToken = integration.mcp_enabled && integration.mcp_token_encrypted ? 
      decrypt(integration.mcp_token_encrypted) : undefined;
      
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
      },
      mcpToken
    );

    // Fetch invoices from GoHighLevel
    console.log('Starting invoice sync from GoHighLevel...');
    console.log('Location ID:', ghlClient.getLocationId());
    
    let allInvoices: any[] = [];
    let hasMore = true;
    let offset = 0;
    let totalFetched = 0;
    
    // Fetch all invoices with pagination
    while (hasMore && totalFetched < 1000) { // Safety limit
      console.log(`Fetching invoice batch (offset: ${offset})`);
      
      try {
        const response = await ghlClient.getInvoices({
          limit: 100,
          offset
        });
        
        console.log('Raw invoice response:', JSON.stringify(response).substring(0, 500));
        
        // Handle different response structures
        let invoices = [];
        if (response.invoices) {
          invoices = response.invoices;
        } else if (response.data) {
          invoices = response.data;
        } else if (Array.isArray(response)) {
          invoices = response;
        }
        
        console.log(`Found ${Array.isArray(invoices) ? invoices.length : 0} invoices`);
        if (invoices.length > 0) {
          console.log('First invoice structure:', JSON.stringify(invoices[0], null, 2));
        }
        
        if (Array.isArray(invoices)) {
          allInvoices.push(...invoices);
          totalFetched += invoices.length;
          
          // Increment offset for next page
          offset += invoices.length;
          
          // Stop if we got less than limit (no more pages)
          if (invoices.length < 100) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } catch (error: any) {
        console.error('Error fetching invoices:', error);
        console.error('Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          status: error.status,
          stack: error.stack
        });
        
        // Check if it's a permissions issue
        const isForbidden = error.message?.includes('Forbidden') || error.statusCode === 403;
        
        if (isForbidden) {
          return NextResponse.json({ 
            error: 'GoHighLevel integration needs to be reconnected with invoice access permissions.',
            requiresReauth: true,
            details: {
              message: 'The invoice sync feature requires access to invoice data. Please reconnect your GoHighLevel integration.',
              error: error.message
            }
          }, { status: 403 });
        }
        
        // If first request fails, return empty array to continue
        if (totalFetched === 0) {
          console.log('First invoice request failed, assuming no invoices exist');
          hasMore = false;
          continue;
        }
        
        throw error;
      }
    }
    
    console.log(`Total invoices fetched: ${allInvoices.length}`);
    
    // Process and prepare invoices for database
    const eventsToUpsert = [];
    
    for (const invoice of allInvoices) {
      // Parse invoice data
      const invoiceDate = invoice.createdAt || invoice.dateCreated || invoice.created_at;
      const paidDate = invoice.paidDate || invoice.paid_date;
      const status = (invoice.status || '').toLowerCase();
      
      // Map invoice status to event type
      let eventType = 'invoice_created';
      if (status === 'paid') {
        eventType = 'invoice_paid';
      } else if (status === 'sent') {
        eventType = 'invoice_sent';
      } else if (status === 'viewed') {
        eventType = 'invoice_viewed';
      } else if (status === 'void') {
        eventType = 'invoice_voided';
      }
      
      eventsToUpsert.push({
        organization_id: organization.organizationId,
        event_source: 'invoice',
        event_type: eventType,
        event_date: paidDate || invoiceDate,
        
        // GHL references
        invoice_id: invoice._id || invoice.id,
        opportunity_id: invoice.opportunityDetails?.opportunityId || invoice.opportunityId || invoice.opportunity_id,
        contact_id: invoice.contactDetails?.id || invoice.contactId || invoice.contact_id,
        
        // Financial details
        event_amount: parseFloat(invoice.total || invoice.amount || invoice.amountDue || 0),
        currency: invoice.currency || 'USD',
        
        // Event data includes all metadata
        event_data: {
          status: status,
          integration_id: integrationId,
          invoice_number: invoice.invoiceNumber || invoice.number || invoice.name,
          amount_paid: parseFloat(invoice.amountPaid || invoice.amount_paid || 0),
          amount_due: parseFloat(invoice.amountDue || invoice.amount_due || invoice.total || 0),
          due_date: invoice.dueDate || invoice.due_date,
          sent_date: invoice.sentDate || invoice.sent_date,
          line_items: invoice.items || invoice.lineItems || [],
          terms: invoice.terms,
          notes: invoice.notes,
          payment_method: invoice.paymentMethod,
          stripe_invoice_id: invoice.stripeInvoiceId,
          last_payment_attempt: invoice.lastPaymentAttempt,
          raw_invoice: invoice
        }
      });
    }
    
    console.log(`Prepared ${eventsToUpsert.length} invoice events for upsert`);
    
    // Upsert invoice events to database
    if (eventsToUpsert.length > 0) {
      // Process in batches to avoid timeout
      const batchSize = 50;
      let successCount = 0;
      
      for (let i = 0; i < eventsToUpsert.length; i += batchSize) {
        const batch = eventsToUpsert.slice(i, i + batchSize);
        
        // First, delete existing invoice events to avoid duplicates
        await supabase
          .from('commission_events')
          .delete()
          .eq('organization_id', organization.organizationId)
          .eq('event_source', 'invoice')
          .in('invoice_id', batch.map(e => e.invoice_id));
        
        // Then insert new events
        console.log(`Inserting batch of ${batch.length} events`);
        console.log('Sample event to insert:', JSON.stringify(batch[0], null, 2));
        
        const { error: insertError, data: insertedData } = await supabase
          .from('commission_events')
          .insert(batch)
          .select();

        if (insertError) {
          console.error('Error inserting batch:', insertError);
          console.error('Failed batch:', JSON.stringify(batch, null, 2));
        } else {
          successCount += batch.length;
          console.log(`Successfully inserted ${batch.length} events`);
        }
      }
      
      console.log(`Successfully upserted ${successCount} invoice events`);
    }
    
    // Get summary of synced invoices
    const { data: summary, error: summaryError } = await supabase
      .from('commission_events')
      .select('event_data')
      .eq('organization_id', organization.organizationId)
      .eq('event_source', 'invoice');
    
    const stats = {
      total: summary?.length || 0,
      draft: summary?.filter(i => i.event_data?.status === 'draft').length || 0,
      sent: summary?.filter(i => i.event_data?.status === 'sent').length || 0,
      paid: summary?.filter(i => i.event_data?.status === 'paid').length || 0,
      void: summary?.filter(i => i.event_data?.status === 'void').length || 0,
      overdue: summary?.filter(i => i.event_data?.status === 'overdue').length || 0
    };
    
    return NextResponse.json({
      success: true,
      message: eventsToUpsert.length > 0 
        ? `Successfully synced ${eventsToUpsert.length} invoices`
        : allInvoices.length > 0
          ? `Found ${allInvoices.length} invoices but none needed syncing`
          : 'No invoices found in GoHighLevel. You may need to create some invoices first.',
      stats: {
        fetched: allInvoices.length,
        synced: eventsToUpsert.length,
        ...stats
      }
    });

  } catch (error) {
    console.error('Invoice sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}