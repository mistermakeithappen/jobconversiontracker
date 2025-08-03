import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Verify webhook signature from GoHighLevel
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return hash === signature;
}

// This webhook receives estimate notifications from GoHighLevel
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // Get webhook data
    const webhookData = await request.json();
    console.log('Received GHL estimate webhook:', JSON.stringify(webhookData, null, 2));

    // Extract webhook type and estimate data
    const { type, data, locationId } = webhookData;
    
    if (!type || !data) {
      console.error('Invalid webhook format');
      return NextResponse.json({ error: 'Invalid webhook format' }, { status: 400 });
    }

    // Find the integration by location ID
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id, organization_id')
      .eq('config->locationId', locationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found for location:', locationId);
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Handle different webhook types
    switch (type) {
      case 'EstimateCreated':
      case 'estimate.created':
        await handleEstimateCreated(supabase, integration, data);
        break;
        
      case 'EstimateSent':
      case 'estimate.sent':
        await handleEstimateSent(supabase, integration, data);
        break;
        
      case 'EstimateAccepted':
      case 'estimate.accepted':
        await handleEstimateAccepted(supabase, integration, data);
        break;
        
      case 'EstimateDeclined':
      case 'estimate.declined':
        await handleEstimateDeclined(supabase, integration, data);
        break;
        
      case 'EstimateExpired':
      case 'estimate.expired':
        await handleEstimateExpired(supabase, integration, data);
        break;
        
      default:
        console.log('Unhandled estimate webhook type:', type);
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleEstimateCreated(supabase: any, integration: any, estimateData: any) {
  console.log('Processing estimate creation:', estimateData);
  
  const {
    id: estimateId,
    estimateNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    status,
    createdAt,
    lineItems,
    validUntil
  } = estimateData;

  // Calculate total amount from line items if not provided
  const totalAmount = amount || (lineItems?.reduce((sum: number, item: any) => 
    sum + (item.price * item.quantity), 0) || 0);

  // Create commission event for estimate creation
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'estimate',
      event_type: 'estimate_created',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      estimate_id: estimateId,
      contact_id: contactId,
      event_amount: totalAmount,
      currency: currency || 'USD',
      event_data: {
        estimate_number: estimateNumber,
        estimate_name: name,
        status: status,
        valid_until: validUntil,
        line_items_count: lineItems?.length || 0
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for estimate:', commissionEvent.id);
  }
}

async function handleEstimateSent(supabase: any, integration: any, estimateData: any) {
  console.log('Processing estimate sent:', estimateData);
  
  const {
    id: estimateId,
    estimateNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    sentAt,
    sentTo,
    sentBy
  } = estimateData;

  // Create commission event for estimate sent
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'estimate',
      event_type: 'estimate_sent',
      event_date: sentAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      estimate_id: estimateId,
      contact_id: contactId,
      event_amount: amount,
      currency: currency || 'USD',
      event_data: {
        estimate_number: estimateNumber,
        estimate_name: name,
        sent_to: sentTo,
        sent_by: sentBy
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for estimate sent:', commissionEvent.id);
  }
}

async function handleEstimateAccepted(supabase: any, integration: any, estimateData: any) {
  console.log('Processing estimate acceptance:', estimateData);
  
  const {
    id: estimateId,
    estimateNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    acceptedAt,
    acceptedBy,
    invoiceId,
    signature
  } = estimateData;

  // Create commission event for estimate acceptance
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'estimate',
      event_type: 'estimate_accepted',
      event_date: acceptedAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      estimate_id: estimateId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: amount,
      currency: currency || 'USD',
      event_data: {
        estimate_number: estimateNumber,
        estimate_name: name,
        accepted_by: acceptedBy,
        has_signature: !!signature,
        converted_to_invoice: !!invoiceId
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for estimate acceptance:', commissionEvent.id);
  }

  // If opportunity ID exists, update pipeline stage status
  if (opportunityId) {
    const { data: opportunityData } = await supabase
      .from('opportunity_cache')
      .select('pipeline_id, stage_id, stage_name')
      .eq('organization_id', integration.organization_id)
      .eq('opportunity_id', opportunityId)
      .single();
    
    if (opportunityData && opportunityData.stage_id) {
      await supabase.rpc('update_commissions_on_stage_change', {
        p_organization_id: integration.organization_id,
        p_opportunity_id: opportunityId,
        p_pipeline_id: opportunityData.pipeline_id,
        p_stage_id: opportunityData.stage_id,
        p_stage_name: opportunityData.stage_name
      });
    }
  }
}

async function handleEstimateDeclined(supabase: any, integration: any, estimateData: any) {
  console.log('Processing estimate decline:', estimateData);
  
  const {
    id: estimateId,
    estimateNumber,
    contactId,
    opportunityId,
    declinedAt,
    declinedBy,
    declineReason
  } = estimateData;

  // Create commission event for estimate decline (for tracking purposes)
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'estimate',
      event_type: 'estimate_declined',
      event_date: declinedAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      estimate_id: estimateId,
      contact_id: contactId,
      event_amount: 0, // No amount for declined estimates
      currency: 'USD',
      event_data: {
        estimate_number: estimateNumber,
        declined_by: declinedBy,
        decline_reason: declineReason
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark any pending commissions for this estimate as cancelled
  if (estimateId) {
    await supabase
      .from('commission_records')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending')
      .in('event_id', 
        supabase
          .from('commission_events')
          .select('id')
          .eq('estimate_id', estimateId)
          .in('event_type', ['estimate_created', 'estimate_sent'])
      );
  }
}

async function handleEstimateExpired(supabase: any, integration: any, estimateData: any) {
  console.log('Processing estimate expiration:', estimateData);
  
  const {
    id: estimateId,
    estimateNumber,
    contactId,
    opportunityId,
    expiredAt,
    originalValidUntil
  } = estimateData;

  // Create commission event for estimate expiration (for tracking purposes)
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'estimate',
      event_type: 'estimate_expired',
      event_date: expiredAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      estimate_id: estimateId,
      contact_id: contactId,
      event_amount: 0, // No amount for expired estimates
      currency: 'USD',
      event_data: {
        estimate_number: estimateNumber,
        original_valid_until: originalValidUntil
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark any pending commissions for this estimate as on hold
  if (estimateId) {
    await supabase
      .from('commission_records')
      .update({
        status: 'on_hold',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending')
      .in('event_id', 
        supabase
          .from('commission_events')
          .select('id')
          .eq('estimate_id', estimateId)
          .in('event_type', ['estimate_created', 'estimate_sent'])
      );
  }
}