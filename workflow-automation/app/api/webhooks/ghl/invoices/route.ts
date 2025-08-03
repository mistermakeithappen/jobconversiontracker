import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Verify webhook signature from GoHighLevel
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return hash === signature;
}

// This webhook receives invoice notifications from GoHighLevel
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // Get webhook data
    const webhookData = await request.json();
    console.log('Received GHL invoice webhook:', JSON.stringify(webhookData, null, 2));

    // Extract webhook type and invoice data
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
      case 'InvoiceCreated':
      case 'invoice.created':
        await handleInvoiceCreated(supabase, integration, data);
        break;
        
      case 'InvoiceSent':
      case 'invoice.sent':
        await handleInvoiceSent(supabase, integration, data);
        break;
        
      case 'InvoicePaid':
      case 'invoice.paid':
        await handleInvoicePaid(supabase, integration, data);
        break;
        
      case 'InvoiceOverdue':
      case 'invoice.overdue':
        await handleInvoiceOverdue(supabase, integration, data);
        break;
        
      case 'InvoiceVoided':
      case 'invoice.voided':
        await handleInvoiceVoided(supabase, integration, data);
        break;
        
      default:
        console.log('Unhandled invoice webhook type:', type);
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('Invoice webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleInvoiceCreated(supabase: any, integration: any, invoiceData: any) {
  console.log('Processing invoice creation:', invoiceData);
  
  const {
    id: invoiceId,
    invoiceNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    status,
    createdAt,
    dueDate,
    lineItems
  } = invoiceData;

  // Calculate total amount from line items if not provided
  const totalAmount = amount || (lineItems?.reduce((sum: number, item: any) => 
    sum + (item.price * item.quantity), 0) || 0);

  // Create commission event for invoice creation
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'invoice',
      event_type: 'invoice_created',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: totalAmount,
      currency: currency || 'USD',
      event_data: {
        invoice_number: invoiceNumber,
        invoice_name: name,
        status: status,
        due_date: dueDate,
        line_items_count: lineItems?.length || 0
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for invoice:', commissionEvent.id);
  }
}

async function handleInvoiceSent(supabase: any, integration: any, invoiceData: any) {
  console.log('Processing invoice sent:', invoiceData);
  
  const {
    id: invoiceId,
    invoiceNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    sentAt,
    sentTo,
    sentBy
  } = invoiceData;

  // Create commission event for invoice sent
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'invoice',
      event_type: 'invoice_sent',
      event_date: sentAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: amount,
      currency: currency || 'USD',
      event_data: {
        invoice_number: invoiceNumber,
        invoice_name: name,
        sent_to: sentTo,
        sent_by: sentBy
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for invoice sent:', commissionEvent.id);
  }
}

async function handleInvoicePaid(supabase: any, integration: any, invoiceData: any) {
  console.log('Processing invoice payment:', invoiceData);
  
  const {
    id: invoiceId,
    invoiceNumber,
    name,
    amount,
    currency,
    contactId,
    opportunityId,
    paidAt,
    paidAmount,
    paymentMethod,
    transactionId
  } = invoiceData;

  // Create commission event for invoice payment
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'invoice',
      event_type: 'invoice_paid',
      event_date: paidAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: paidAmount || amount,
      currency: currency || 'USD',
      event_data: {
        invoice_number: invoiceNumber,
        invoice_name: name,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        full_amount_paid: (paidAmount || amount) === amount
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created for invoice payment:', commissionEvent.id);
  }

  // If opportunity ID exists, trigger commission calculations
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

async function handleInvoiceOverdue(supabase: any, integration: any, invoiceData: any) {
  console.log('Processing invoice overdue:', invoiceData);
  
  const {
    id: invoiceId,
    invoiceNumber,
    contactId,
    opportunityId,
    overdueAt,
    originalDueDate,
    daysPastDue
  } = invoiceData;

  // Create commission event for invoice overdue (for tracking purposes)
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'invoice',
      event_type: 'invoice_overdue',
      event_date: overdueAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: 0, // No amount for overdue notification
      currency: 'USD',
      event_data: {
        invoice_number: invoiceNumber,
        original_due_date: originalDueDate,
        days_past_due: daysPastDue
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark any pending commissions for this invoice as on hold
  if (invoiceId) {
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
          .eq('invoice_id', invoiceId)
          .in('event_type', ['invoice_created', 'invoice_sent'])
      );
  }
}

async function handleInvoiceVoided(supabase: any, integration: any, invoiceData: any) {
  console.log('Processing invoice void:', invoiceData);
  
  const {
    id: invoiceId,
    invoiceNumber,
    contactId,
    opportunityId,
    voidedAt,
    voidedBy,
    voidReason
  } = invoiceData;

  // Create commission event for invoice void (for tracking purposes)
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'invoice',
      event_type: 'invoice_voided',
      event_date: voidedAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      invoice_id: invoiceId,
      contact_id: contactId,
      event_amount: 0, // No amount for voided invoices
      currency: 'USD',
      event_data: {
        invoice_number: invoiceNumber,
        voided_by: voidedBy,
        void_reason: voidReason
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark any pending commissions for this invoice as cancelled
  if (invoiceId) {
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
          .eq('invoice_id', invoiceId)
          .in('event_type', ['invoice_created', 'invoice_sent'])
      );
  }
}