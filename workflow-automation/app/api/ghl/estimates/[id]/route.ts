import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Query the specific estimate from the dedicated table
    const { data: estimate, error } = await supabase
      .from('ghl_estimates')
      .select(`
        *,
        converted_invoice:converted_invoice_id (
          ghl_invoice_id,
          invoice_number,
          status,
          amount_paid
        ),
        status_history:ghl_estimate_status_history (
          from_status,
          to_status,
          changed_at,
          changed_by,
          notes
        )
      `)
      .eq('organization_id', organization.organizationId)
      .eq('ghl_estimate_id', params.id)
      .single();

    if (error) {
      console.error('Error fetching estimate:', error);
      
      // Fallback to commission_events for backwards compatibility
      console.log('Falling back to commission_events...');
      return await getFallbackEstimateDetail(supabase, organization.organizationId, params.id);
    }

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format
    const transformedEstimate = {
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
      sentDate: estimate.sent_date,
      viewedDate: estimate.viewed_date,
      responseDate: estimate.response_date,
      convertedToInvoice: estimate.converted_to_invoice,
      convertedInvoice: estimate.converted_invoice,
      description: estimate.description,
      lineItems: estimate.line_items,
      terms: estimate.terms,
      notes: estimate.notes,
      metadata: estimate.metadata,
      
      // Status history for timeline
      statusHistory: estimate.status_history?.map((history: any) => ({
        fromStatus: history.from_status,
        toStatus: history.to_status,
        changedAt: history.changed_at,
        changedBy: history.changed_by,
        notes: history.notes
      })) || []
    };

    return NextResponse.json({
      estimate: transformedEstimate
    });

  } catch (error) {
    console.error('Estimate detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch estimate' },
      { status: 500 }
    );
  }
}

// Fallback function to get estimate from commission_events (for backwards compatibility)
async function getFallbackEstimateDetail(supabase: any, organizationId: string, estimateId: string) {
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
      .eq('estimate_id', estimateId)
      .order('event_date', { ascending: true });

    if (error || !estimateEvents || estimateEvents.length === 0) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Build estimate object from events
    const firstEvent = estimateEvents[0];
    const lastEvent = estimateEvents[estimateEvents.length - 1];

    const estimate = {
      id: estimateId,
      estimateNumber: firstEvent.event_data?.estimate_number,
      name: firstEvent.event_data?.estimate_name,
      amount: firstEvent.event_amount,
      currency: firstEvent.currency,
      status: getStatusFromEventType(lastEvent.event_type),
      contactId: firstEvent.contact_id,
      opportunityId: firstEvent.opportunity_id,
      contact: firstEvent.contacts,
      createdAt: firstEvent.event_date,
      lastUpdated: lastEvent.event_date,
      validUntil: firstEvent.event_data?.valid_until,
      
      // Event history for timeline
      events: estimateEvents.map(event => ({
        type: event.event_type,
        date: event.event_date,
        data: event.event_data,
        amount: event.event_amount
      })),
      
      // Additional details from latest event
      sentTo: lastEvent.event_data?.sent_to,
      sentBy: lastEvent.event_data?.sent_by,
      acceptedBy: lastEvent.event_data?.accepted_by,
      declinedBy: lastEvent.event_data?.declined_by,
      declineReason: lastEvent.event_data?.decline_reason,
      hasSignature: lastEvent.event_data?.has_signature,
      convertedToInvoice: lastEvent.event_data?.converted_to_invoice,
      invoiceId: lastEvent.invoice_id
    };

    return NextResponse.json({
      estimate
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch estimate' },
      { status: 500 }
    );
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