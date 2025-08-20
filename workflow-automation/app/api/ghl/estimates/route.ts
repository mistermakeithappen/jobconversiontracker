import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { GHLClient } from '@/lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { requireSubscription } from '@/lib/utils/subscription-utils';

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
    
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (!integration || !integration.tokens) {
      return NextResponse.json(
        { error: 'GoHighLevel integration not found or not configured' },
        { status: 404 }
      );
    }

    // Decrypt tokens and create GHL client
    const encryptedTokens = integration.tokens;
    const tokens = {
      accessToken: decrypt(encryptedTokens.accessToken),
      refreshToken: decrypt(encryptedTokens.refreshToken),
      expiresAt: encryptedTokens.expiresAt,
      locationId: encryptedTokens.locationId || integration.config?.locationId,
      companyId: encryptedTokens.companyId || '',
      userId: encryptedTokens.userId || ''
    };

    const ghlClient = new GHLClient(tokens, async (newTokens) => {
      // Update tokens in database
      const { error } = await supabase
        .from('integrations')
        .update({
          tokens: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: encrypt(newTokens.refreshToken),
            expiresAt: newTokens.expiresAt,
            locationId: newTokens.locationId,
            companyId: newTokens.companyId,
            userId: newTokens.userId
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);
        
      if (error) {
        console.error('Failed to update tokens:', error);
      }
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const limit = parseInt(searchParams.get('limit') || '25');
    const startAfterId = searchParams.get('startAfterId');

    // Query estimates from the dedicated ghl_estimates table
    let queryBuilder = supabase
      .from('ghl_estimates')
      .select(`
        *,
        converted_invoice:converted_invoice_id (
          ghl_invoice_id,
          invoice_number,
          status,
          amount_paid
        )
      `)
      .eq('organization_id', organization.organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }
    
    if (contactId) {
      queryBuilder = queryBuilder.eq('contact_id', contactId);
    }
    
    if (startAfterId) {
      queryBuilder = queryBuilder.gt('created_at', startAfterId);
    }
    
    queryBuilder = queryBuilder.limit(limit);

    const { data: estimates, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching estimates:', error);
      
      // Fallback to commission_events if ghl_estimates table doesn't exist yet
      console.log('Falling back to commission_events table...');
      return await getFallbackEstimates(supabase, organization.organizationId, { status, contactId, limit, startAfterId });
    }

    // Transform the data to match the expected format
    const transformedEstimates = (estimates || []).map(estimate => ({
      id: estimate.ghl_estimate_id,
      estimateNumber: estimate.estimate_number,
      name: estimate.name,
      amount: estimate.amount,
      currency: estimate.currency,
      status: estimate.status,
      contactId: estimate.contact_id,
      opportunityId: estimate.opportunity_id,
      contact: null, // TODO: Join with contacts table if needed
      createdAt: estimate.created_date || estimate.created_at,
      lastUpdated: estimate.updated_at,
      validUntil: estimate.expiry_date,
      convertedToInvoice: estimate.converted_to_invoice,
      convertedInvoice: estimate.converted_invoice,
      description: estimate.description,
      lineItems: estimate.line_items,
      notes: estimate.notes,
      metadata: estimate.metadata
    }));

    const finalEstimates = transformedEstimates;

    return NextResponse.json({
      estimates: finalEstimates,
      totalCount: finalEstimates.length
    });

  } catch (error) {
    console.error('Estimates API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch estimates' },
      { status: 500 }
    );
  }
}

// Fallback function to get estimates from commission_events (for backwards compatibility)
async function getFallbackEstimates(supabase: any, organizationId: string, filters: any) {
  try {
    const { data: estimateEvents, error } = await supabase
      .from('commission_events')
      .select(`
        *,
        contacts:contact_id (
          name,
          email,
          phone
        )
      `)
      .eq('organization_id', organizationId)
      .eq('event_source', 'estimate')
      .in('event_type', ['estimate_created', 'estimate_sent', 'estimate_accepted', 'estimate_declined', 'estimate_expired'])
      .order('event_date', { ascending: false })
      .limit(filters.limit || 25);

    if (error || !estimateEvents) {
      return NextResponse.json({
        estimates: [],
        totalCount: 0
      });
    }

    // Group by estimate_id to get the latest status for each estimate
    const estimatesMap = new Map();
    
    for (const event of estimateEvents) {
      const estimateId = event.estimate_id;
      if (!estimatesMap.has(estimateId) || 
          new Date(event.event_date) > new Date(estimatesMap.get(estimateId).event_date)) {
        estimatesMap.set(estimateId, {
          id: estimateId,
          estimateNumber: event.event_data?.estimate_number,
          name: event.event_data?.estimate_name,
          amount: event.event_amount,
          currency: event.currency,
          status: getStatusFromEventType(event.event_type),
          contactId: event.contact_id,
          opportunityId: event.opportunity_id,
          contact: event.contacts,
          createdAt: event.event_date,
          lastUpdated: event.event_date,
          validUntil: event.event_data?.valid_until,
          eventType: event.event_type,
          eventData: event.event_data,
          convertedToInvoice: false
        });
      }
    }

    const estimates = Array.from(estimatesMap.values());

    // Apply status filter if provided
    const filteredEstimates = filters.status 
      ? estimates.filter(est => est.status === filters.status)
      : estimates;

    // Apply contact filter if provided
    const finalEstimates = filters.contactId
      ? filteredEstimates.filter(est => est.contactId === filters.contactId)
      : filteredEstimates;

    return NextResponse.json({
      estimates: finalEstimates,
      totalCount: finalEstimates.length
    });

  } catch (error) {
    return NextResponse.json({
      estimates: [],
      totalCount: 0
    });
  }
}

function getStatusFromEventType(eventType: string): string {
  switch (eventType) {
    case 'estimate_created':
      return 'draft';
    case 'estimate_sent':
      return 'sent';
    case 'estimate_accepted':
      return 'accepted';
    case 'estimate_declined':
      return 'declined';
    case 'estimate_expired':
      return 'expired';
    default:
      return 'draft';
  }
}