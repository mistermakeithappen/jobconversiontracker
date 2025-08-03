import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/sales/sync-estimates - Starting estimate sync request');
    
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

    // Check if MCP token is available for estimates
    const { decrypt, encrypt } = await import('@/lib/utils/encryption');
    
    if (!integration.mcp_enabled || !integration.mcp_token_encrypted) {
      return NextResponse.json({ 
        error: 'Private Integration Token required for estimates',
        requiresPIT: true,
        details: {
          message: 'The estimates feature requires a GoHighLevel Private Integration Token. Please enable MCP and add your PIT in the GHL settings.',
          note: 'Estimates API requires PIT authentication, not OAuth tokens.'
        }
      }, { status: 403 });
    }
    
    // Get MCP token - check if it's stored as API key reference or directly
    let mcpToken;
    try {
      // Try to parse as JSON (new format with API key reference)
      const tokenData = JSON.parse(integration.mcp_token_encrypted);
      
      if (tokenData.type === 'user_api_keys_reference' && tokenData.api_key_id) {
        // Get token from user_api_keys table
        const { data: apiKey, error: keyError } = await supabase
          .from('user_api_keys')
          .select('encrypted_key')
          .eq('id', tokenData.api_key_id)
          .eq('is_active', true)
          .single();
          
        if (keyError || !apiKey) {
          return NextResponse.json({ 
            error: 'MCP API key not found or inactive',
            requiresPIT: true
          }, { status: 403 });
        }
        
        mcpToken = decrypt(apiKey.encrypted_key);
      } else {
        return NextResponse.json({ 
          error: 'Invalid MCP token format',
          requiresPIT: true
        }, { status: 403 });
      }
    } catch (parseError) {
      // Not JSON, assume it's the old direct encrypted token format
      mcpToken = decrypt(integration.mcp_token_encrypted);
    }
    
    // For estimates, we'll use the MCP token directly instead of the OAuth client
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

    // Fetch estimates from GoHighLevel
    console.log('Starting estimate sync from GoHighLevel...');
    console.log('Location ID:', ghlClient.getLocationId());
    
    let allEstimates: any[] = [];
    let hasMore = true;
    let offset = 0;
    let totalFetched = 0;
    
    // Fetch all estimates with pagination
    while (hasMore && totalFetched < 1000) { // Safety limit
      console.log(`Fetching estimate batch (offset: ${offset})`);
      
      try {
        const response = await ghlClient.getEstimates({
          limit: 100,
          offset
        });
        
        console.log('Raw estimate response:', JSON.stringify(response).substring(0, 500));
        
        // Handle different response structures
        let estimates = [];
        if (response.estimates) {
          estimates = response.estimates;
        } else if (response.data) {
          estimates = response.data;
        } else if (Array.isArray(response)) {
          estimates = response;
        }
        
        console.log(`Found ${Array.isArray(estimates) ? estimates.length : 0} estimates`);
        if (estimates.length > 0) {
          console.log('First estimate structure:', JSON.stringify(estimates[0], null, 2));
        }
        
        if (Array.isArray(estimates)) {
          allEstimates.push(...estimates);
          totalFetched += estimates.length;
          
          // Increment offset for next page
          offset += estimates.length;
          
          // Stop if we got less than limit (no more pages)
          if (estimates.length < 100) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } catch (error: any) {
        console.error('Error fetching estimates:', error);
        console.error('Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          status: error.status,
          stack: error.stack
        });
        
        // Check if it's a permissions issue
        const isForbidden = error.message?.includes('Forbidden') || error.statusCode === 403;
        const isUnauthorized = error.message?.includes('not authorized for this scope') || error.statusCode === 401;
        const isNotFound = error.message?.includes('404') || error.message?.includes('Not Found') || error.statusCode === 404;
        
        if (isForbidden || isUnauthorized) {
          return NextResponse.json({ 
            error: 'GoHighLevel integration needs additional permissions for estimates.',
            requiresReauth: true,
            details: {
              message: 'The estimates feature requires specific API permissions. Please reconnect your GoHighLevel integration and ensure the "Invoices & Estimates" scope is enabled.',
              error: error.message,
              note: 'Estimates require a separate API scope from invoices in GoHighLevel.'
            }
          }, { status: 403 });
        }
        
        // If first request fails with 404, it might mean no estimates exist or wrong endpoint
        if (totalFetched === 0) {
          console.log('First estimate request failed, this could mean:');
          console.log('1. No estimates exist in GoHighLevel');
          console.log('2. Estimates feature is not enabled for this location');
          console.log('3. The API endpoint has changed');
          hasMore = false;
          continue;
        }
        
        throw error;
      }
    }
    
    console.log(`Total estimates fetched: ${allEstimates.length}`);
    
    // Process and prepare estimates for database
    const estimatesToUpsert = [];
    
    for (const estimate of allEstimates) {
      // Parse estimate data
      const estimateDate = estimate.createdAt || estimate.dateCreated || estimate.created_at;
      const sentDate = estimate.sentDate || estimate.sent_date;
      const viewedDate = estimate.viewedDate || estimate.viewed_date;
      const responseDate = estimate.responseDate || estimate.response_date;
      const expiryDate = estimate.validUntil || estimate.valid_until || estimate.expiryDate;
      const status = (estimate.status || '').toLowerCase();
      
      estimatesToUpsert.push({
        organization_id: organization.organizationId,
        integration_id: integrationId,
        ghl_estimate_id: estimate._id || estimate.id,
        estimate_number: estimate.estimateNumber || estimate.number || estimate.name,
        
        // GHL references - use the correct contact ID from contactDetails
        opportunity_id: estimate.opportunityDetails?.opportunityId || estimate.opportunityId || estimate.opportunity_id,
        contact_id: estimate.contactDetails?.id || estimate.contactId || estimate.contact_id,
        
        // Estimate details
        name: estimate.name || estimate.title || `Estimate #${estimate.estimateNumber || estimate.number || 'N/A'}`,
        description: estimate.description || null,
        amount: parseFloat(estimate.total || estimate.amount || 0),
        currency: estimate.currency || 'USD',
        
        // Status tracking
        status: status || 'draft',
        
        // Dates
        created_date: estimateDate,
        sent_date: sentDate,
        viewed_date: viewedDate,
        response_date: responseDate,
        expiry_date: expiryDate,
        
        // Line items and metadata
        line_items: estimate.items || estimate.lineItems || [],
        terms: estimate.terms || null,
        notes: estimate.notes || null,
        metadata: {
          raw_estimate: estimate,
          source: 'ghl_sync'
        },
        
        // Sync tracking
        synced_at: new Date().toISOString()
      });
    }
    
    console.log(`Prepared ${estimatesToUpsert.length} estimates for upsert`);
    
    // Upsert estimates to ghl_estimates table
    if (estimatesToUpsert.length > 0) {
      // Process in batches to avoid timeout
      const batchSize = 50;
      let successCount = 0;
      
      for (let i = 0; i < estimatesToUpsert.length; i += batchSize) {
        const batch = estimatesToUpsert.slice(i, i + batchSize);
        
        console.log(`Upserting batch of ${batch.length} estimates`);
        console.log('Sample estimate to upsert:', JSON.stringify(batch[0], null, 2));
        
        // Upsert to ghl_estimates table - use upsert to handle duplicates
        const { error: upsertError, data: upsertedData } = await supabase
          .from('ghl_estimates')
          .upsert(batch, {
            onConflict: 'organization_id,ghl_estimate_id',
            ignoreDuplicates: false
          })
          .select();

        if (upsertError) {
          console.error('Error upserting batch:', upsertError);
          console.error('Failed batch:', JSON.stringify(batch, null, 2));
          // Continue with next batch even if one fails
        } else {
          successCount += batch.length;
          console.log(`Successfully upserted ${batch.length} estimates`);
        }
      }
      
      console.log(`Successfully upserted ${successCount} estimates to ghl_estimates table`);
    }
    
    // Get summary of synced estimates from ghl_estimates table
    const { data: summary, error: summaryError } = await supabase
      .from('ghl_estimates')
      .select('status')
      .eq('organization_id', organization.organizationId);
    
    const stats = {
      total: summary?.length || 0,
      draft: summary?.filter(e => e.status === 'draft').length || 0,
      sent: summary?.filter(e => e.status === 'sent').length || 0,
      accepted: summary?.filter(e => e.status === 'accepted').length || 0,
      declined: summary?.filter(e => e.status === 'declined').length || 0,
      expired: summary?.filter(e => e.status === 'expired').length || 0
    };
    
    return NextResponse.json({
      success: true,
      message: estimatesToUpsert.length > 0 
        ? `Successfully synced ${estimatesToUpsert.length} estimates`
        : allEstimates.length > 0
          ? `Found ${allEstimates.length} estimates but none needed syncing`
          : 'No estimates found in GoHighLevel. You may need to create some estimates first.',
      stats: {
        fetched: allEstimates.length,
        synced: estimatesToUpsert.length,
        ...stats
      }
    });

  } catch (error) {
    console.error('Estimate sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}