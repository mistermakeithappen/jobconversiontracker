import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Verify webhook signature from GoHighLevel
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return hash === signature;
}

// This webhook receives payment notifications from GoHighLevel
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // Get webhook data
    const webhookData = await request.json();
    console.log('Received GHL payment webhook:', JSON.stringify(webhookData, null, 2));

    // Extract webhook type and payment data
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
      case 'PaymentSuccess':
      case 'payment.success':
        await handlePaymentSuccess(supabase, integration, data);
        break;
        
      case 'PaymentFailed':
      case 'payment.failed':
        await handlePaymentFailed(supabase, integration, data);
        break;
        
      case 'SubscriptionCreated':
      case 'subscription.created':
        await handleSubscriptionCreated(supabase, integration, data);
        break;
        
      case 'SubscriptionRenewed':
      case 'subscription.renewed':
        await handleSubscriptionRenewed(supabase, integration, data);
        break;
        
      case 'SubscriptionCancelled':
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(supabase, integration, data);
        break;
        
      case 'RefundProcessed':
      case 'refund.processed':
        await handleRefundProcessed(supabase, integration, data);
        break;
        
      default:
        console.log('Unhandled webhook type:', type);
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

async function handlePaymentSuccess(supabase: any, integration: any, paymentData: any) {
  console.log('Processing payment success:', paymentData);
  
  // Extract payment details
  const {
    id: paymentId,
    transactionId,
    invoiceId,
    orderId,
    subscriptionId,
    amount,
    currency,
    paymentMethod,
    contactId,
    opportunityId,
    productId,
    productName,
    createdAt
  } = paymentData;

  // Convert amount from cents to dollars if needed
  const paymentAmount = amount > 1000 ? amount / 100 : amount;

  // Find product in our database
  let productRecord = null;
  if (productId) {
    const { data: product } = await supabase
      .from('ghl_products')
      .select('*')
      .eq('integration_id', integration.id)
      .eq('ghl_product_id', productId)
      .single();
    
    productRecord = product;
  }

  // Create commission event for this payment
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: invoiceId ? 'invoice' : subscriptionId ? 'subscription' : 'payment',
      event_type: 'payment_collected',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      payment_id: paymentId,
      invoice_id: invoiceId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: paymentAmount,
      currency: currency || 'USD',
      event_data: {
        payment_method: paymentMethod,
        product_id: productId,
        product_name: productName,
        transaction_id: transactionId,
        order_id: orderId
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  } else {
    console.log('Commission event created:', commissionEvent.id);
  }

  // Create sales transaction
  const transactionData = {
    organization_id: integration.organization_id,
    integration_id: integration.id,
    opportunity_id: opportunityId,
    contact_id: contactId,
    product_id: productRecord?.id || null,
    ghl_invoice_id: invoiceId,
    ghl_payment_id: paymentId,
    ghl_transaction_id: transactionId,
    subscription_id: subscriptionId,
    amount: paymentAmount,
    currency: currency || 'USD',
    payment_date: createdAt || new Date().toISOString(),
    payment_method: paymentMethod || 'unknown',
    payment_status: 'completed',
    transaction_type: subscriptionId ? 'subscription_renewal' : 'sale',
    raw_webhook_data: paymentData
  };

  const { data: transaction, error: transactionError } = await supabase
    .from('sales_transactions')
    .insert(transactionData)
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating transaction:', transactionError);
  }

  // If this payment is for an opportunity, check and update pipeline stage status
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

async function handlePaymentFailed(supabase: any, integration: any, paymentData: any) {
  console.log('Processing payment failure:', paymentData);
  
  // Extract payment details
  const {
    id: paymentId,
    transactionId,
    invoiceId,
    orderId,
    subscriptionId,
    amount,
    currency,
    paymentMethod,
    contactId,
    opportunityId,
    createdAt,
    failureReason
  } = paymentData;

  // Convert amount from cents to dollars if needed
  const paymentAmount = amount > 1000 ? amount / 100 : amount;

  // Create commission event for failed payment (for tracking purposes)
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: invoiceId ? 'invoice' : subscriptionId ? 'subscription' : 'payment',
      event_type: 'payment_failed',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      payment_id: paymentId,
      invoice_id: invoiceId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: paymentAmount,
      currency: currency || 'USD',
      event_data: {
        payment_method: paymentMethod,
        transaction_id: transactionId,
        order_id: orderId,
        failure_reason: failureReason
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Create failed transaction record
  const transactionData = {
    organization_id: integration.organization_id,
    integration_id: integration.id,
    opportunity_id: opportunityId,
    contact_id: contactId,
    ghl_payment_id: paymentId,
    ghl_transaction_id: transactionId,
    amount: paymentAmount,
    currency: currency || 'USD',
    payment_date: createdAt || new Date().toISOString(),
    payment_method: paymentMethod || 'unknown',
    payment_status: 'failed',
    transaction_type: 'sale',
    raw_webhook_data: paymentData
  };

  await supabase
    .from('sales_transactions')
    .insert(transactionData);
}

async function handleSubscriptionCreated(supabase: any, integration: any, subscriptionData: any) {
  console.log('Processing subscription creation:', subscriptionData);
  
  const {
    id: subscriptionId,
    name: subscriptionName,
    amount,
    currency,
    interval,
    intervalCount,
    contactId,
    opportunityId,
    productId,
    createdAt,
    startDate,
    status
  } = subscriptionData;

  // Convert amount from cents to dollars if needed
  const subscriptionAmount = amount > 1000 ? amount / 100 : amount;

  // Create commission event for subscription creation
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'subscription',
      event_type: 'subscription_created',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: subscriptionAmount,
      currency: currency || 'USD',
      event_data: {
        subscription_name: subscriptionName,
        interval: interval,
        interval_count: intervalCount,
        product_id: productId,
        start_date: startDate,
        status: status
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Record initial subscription payment if included
  if (subscriptionData.initialPayment) {
    await handlePaymentSuccess(supabase, integration, {
      ...subscriptionData.initialPayment,
      subscriptionId: subscriptionId,
      opportunityId: opportunityId,
      contactId: contactId
    });
  }
}

async function handleSubscriptionRenewed(supabase: any, integration: any, renewalData: any) {
  console.log('Processing subscription renewal:', renewalData);
  
  const {
    id: paymentId,
    subscriptionId,
    amount,
    currency,
    contactId,
    opportunityId,
    renewalNumber,
    createdAt
  } = renewalData;

  // Convert amount from cents to dollars if needed
  const renewalAmount = amount > 1000 ? amount / 100 : amount;

  // Create commission event for subscription renewal
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'subscription',
      event_type: 'subscription_renewed',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      payment_id: paymentId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: renewalAmount,
      currency: currency || 'USD',
      event_data: {
        renewal_number: renewalNumber || 1
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark previous subscription commissions as verified
  if (subscriptionId) {
    await supabase
      .from('commission_records')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending')
      .in('event_id', 
        supabase
          .from('commission_events')
          .select('id')
          .eq('subscription_id', subscriptionId)
          .eq('event_type', 'subscription_created')
      );
  }
  
  // Process renewal payment
  await handlePaymentSuccess(supabase, integration, renewalData);
}

async function handleSubscriptionCancelled(supabase: any, integration: any, cancellationData: any) {
  console.log('Processing subscription cancellation:', cancellationData);
  
  const {
    subscriptionId,
    contactId,
    opportunityId,
    cancelledAt,
    cancellationReason,
    effectiveDate
  } = cancellationData;

  // Create commission event for subscription cancellation
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: 'subscription',
      event_type: 'subscription_cancelled',
      event_date: cancelledAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: 0, // No amount for cancellation
      currency: 'USD',
      event_data: {
        cancellation_reason: cancellationReason,
        effective_date: effectiveDate
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Mark pending commissions as cancelled
  if (subscriptionId) {
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
          .eq('subscription_id', subscriptionId)
      );
  }
}

async function handleRefundProcessed(supabase: any, integration: any, refundData: any) {
  console.log('Processing refund:', refundData);
  
  const {
    id: refundId,
    originalPaymentId,
    amount,
    currency,
    contactId,
    opportunityId,
    invoiceId,
    subscriptionId,
    createdAt,
    partial,
    percentage,
    reason,
    paymentMethod
  } = refundData;

  // Convert amount from cents to dollars if needed
  const refundAmount = amount > 1000 ? amount / 100 : amount;

  // Create commission event for refund
  const { data: commissionEvent, error: eventError } = await supabase
    .from('commission_events')
    .insert({
      organization_id: integration.organization_id,
      event_source: invoiceId ? 'invoice' : subscriptionId ? 'subscription' : 'payment',
      event_type: partial ? 'payment_partial_refund' : 'payment_refund',
      event_date: createdAt || new Date().toISOString(),
      opportunity_id: opportunityId,
      payment_id: originalPaymentId,
      invoice_id: invoiceId,
      subscription_id: subscriptionId,
      contact_id: contactId,
      event_amount: -refundAmount, // Negative amount for refund
      currency: currency || 'USD',
      event_data: {
        refund_id: refundId,
        partial: partial || false,
        percentage: percentage,
        reason: reason,
        payment_method: paymentMethod
      }
    })
    .select()
    .single();

  if (eventError) {
    console.error('Error creating commission event:', eventError);
  }

  // Create refund transaction
  const transactionData = {
    organization_id: integration.organization_id,
    integration_id: integration.id,
    opportunity_id: opportunityId,
    contact_id: contactId,
    ghl_payment_id: originalPaymentId,
    ghl_transaction_id: refundId,
    ghl_invoice_id: invoiceId,
    subscription_id: subscriptionId,
    amount: -refundAmount, // Negative amount for refund
    currency: currency || 'USD',
    payment_date: createdAt || new Date().toISOString(),
    payment_method: paymentMethod || 'unknown',
    payment_status: 'refunded',
    transaction_type: partial ? 'partial_refund' : 'refund',
    raw_webhook_data: refundData
  };

  const { data: refundTransaction, error } = await supabase
    .from('sales_transactions')
    .insert(transactionData)
    .select()
    .single();

  if (error) {
    console.error('Error creating refund transaction:', error);
    return;
  }

  // Create negative commission adjustments
  if (originalPaymentId) {
    // Find original commission records
    const { data: originalPaymentEvent } = await supabase
      .from('commission_events')
      .select('id')
      .eq('payment_id', originalPaymentId)
      .eq('event_type', 'payment_collected')
      .single();

    if (originalPaymentEvent) {
      const { data: originalCommissions } = await supabase
        .from('commission_records')
        .select('*')
        .eq('event_id', originalPaymentEvent.id);

      if (originalCommissions) {
        for (const commission of originalCommissions) {
          // Create commission adjustment for refund
          const adjustmentAmount = partial 
            ? -(commission.commission_amount * (percentage / 100))
            : -commission.commission_amount;

          await supabase
            .from('commission_adjustments')
            .insert({
              organization_id: integration.organization_id,
              commission_record_id: commission.id,
              adjustment_type: 'clawback',
              adjustment_amount: adjustmentAmount,
              adjustment_reason: `Refund processed: ${reason || 'No reason provided'}`
            });
        }
      }
    }
  }
}