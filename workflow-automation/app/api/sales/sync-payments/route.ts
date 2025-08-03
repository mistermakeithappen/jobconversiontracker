import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/sales/sync-payments - Starting payment sync request');
    
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

    // Fetch payment transactions from GoHighLevel
    console.log('Starting payment sync from GoHighLevel...');
    
    // Get payment transactions from the last 90 days by default
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    let allTransactions: any[] = [];
    let hasMore = true;
    let startAfterId: string | undefined;
    let totalFetched = 0;
    
    // Fetch all payment transactions with pagination
    while (hasMore && totalFetched < 1000) { // Safety limit
      console.log(`Fetching payment batch (startAfterId: ${startAfterId || 'none'})`);
      
      let response;
      try {
        response = await ghlClient.getPaymentTransactions({
          limit: 100,
          startAfterId,
          startAfter: startDate
        });
      } catch (error: any) {
        console.error('Error fetching payments, trying invoices instead:', error);
        
        // If transactions API fails, try using invoices API instead
        try {
          console.log('Attempting to fetch paid invoices as alternative...');
          const invoicesResponse = await ghlClient.getInvoices({
            limit: 100,
            startAfterId,
            status: 'paid'
          });
          
          // Convert invoices to transaction format
          const invoices = invoicesResponse.invoices || invoicesResponse.data || invoicesResponse || [];
          console.log(`Found ${Array.isArray(invoices) ? invoices.length : 0} invoices`);
          
          response = {
            transactions: Array.isArray(invoices) ? invoices.map((invoice: any) => ({
              _id: invoice._id || invoice.id,
              amount: invoice.total || invoice.amount || invoice.amountDue || 0,
              currency: invoice.currency || 'USD',
              createdAt: invoice.paidAt || invoice.datePaid || invoice.updatedAt || invoice.createdAt,
              contactId: invoice.contactId || invoice.contact?.id,
              opportunityId: invoice.opportunityId || invoice.opportunity?.id,
              status: 'succeeded',
              paymentMethod: 'invoice'
            })) : []
          };
        } catch (invoiceError: any) {
          console.error('Both transactions and invoices APIs failed:', invoiceError);
          // Check if it's a permissions issue
          const isForbidden = invoiceError.message?.includes('Forbidden') || 
                            error.message?.includes('Forbidden') ||
                            invoiceError.statusCode === 403;
          
          if (isForbidden) {
            return NextResponse.json({ 
              error: 'GoHighLevel integration needs to be reconnected with payment access permissions.',
              requiresReauth: true,
              details: {
                message: 'The payment sync feature requires access to payment and invoice data. Please reconnect your GoHighLevel integration.',
                transactionError: error.message,
                invoiceError: invoiceError.message
              }
            }, { status: 403 });
          }
          
          return NextResponse.json({ 
            error: `Unable to access payment data: ${invoiceError.message || 'Unknown error'}. You may need to create some invoices in GoHighLevel first.`,
            requiresReauth: false,
            details: {
              transactionError: error.message,
              invoiceError: invoiceError.message
            }
          }, { status: 500 });
        }
      }
      
      const transactions = response.transactions || [];
      allTransactions.push(...transactions);
      totalFetched += transactions.length;
      
      console.log(`Fetched ${transactions.length} transactions, Total: ${totalFetched}`);
      
      // Check for more pages
      if (response.meta?.startAfterId) {
        startAfterId = response.meta.startAfterId;
      } else if (transactions.length > 0) {
        // Use last transaction ID as cursor
        const lastTransaction = transactions[transactions.length - 1];
        startAfterId = lastTransaction._id || lastTransaction.id;
      } else {
        hasMore = false;
      }
      
      // Stop if we got less than limit (no more pages)
      if (transactions.length < 100) {
        hasMore = false;
      }
    }
    
    console.log(`Total payment transactions fetched: ${allTransactions.length}`);
    
    // Also fetch orders to get more transaction details
    console.log('Fetching payment orders...');
    const ordersResponse = await ghlClient.getPaymentOrders({ limit: 100 });
    const orders = ordersResponse.orders || [];
    console.log(`Fetched ${orders.length} payment orders`);
    
    // Fetch active subscriptions
    console.log('Fetching active subscriptions...');
    let allSubscriptions: any[] = [];
    try {
      const subsResponse = await ghlClient.getSubscriptions({ 
        limit: 100,
        status: 'active'
      });
      allSubscriptions = subsResponse.data || subsResponse.subscriptions || [];
      console.log(`Fetched ${allSubscriptions.length} active subscriptions`);
    } catch (subError) {
      console.log('Could not fetch subscriptions:', subError);
    }
    
    // Create a map of orders by ID for quick lookup
    const ordersMap = new Map();
    orders.forEach((order: any) => {
      ordersMap.set(order._id || order.id, order);
    });
    
    // Process and prepare transactions for database
    const transactionsToUpsert = [];
    
    for (const transaction of allTransactions) {
      // Skip if not a successful payment
      if (transaction.status !== 'succeeded' && transaction.status !== 'paid') {
        continue;
      }
      
      // Get order details if available
      const order = ordersMap.get(transaction.orderId || transaction.order_id);
      
      // Determine transaction type
      let transactionType = 'sale';
      if (transaction.subscriptionId || transaction.subscription_id) {
        transactionType = transaction.isFirstPayment ? 'subscription_initial' : 'subscription_renewal';
      } else if (transaction.refunded) {
        transactionType = transaction.amountRefunded === transaction.amount ? 'refund' : 'partial_refund';
      }
      
      // Find matching product if we have one
      let productId = null;
      if (order?.items && order.items.length > 0) {
        const productItem = order.items[0]; // Take first item
        const { data: product } = await supabase
          .from('ghl_products')
          .select('id')
          .eq('integration_id', integrationId)
          .eq('ghl_product_id', productItem.priceId || productItem.productId || productItem._id)
          .single();
        
        if (product) {
          productId = product.id;
        }
      }
      
      transactionsToUpsert.push({
        organization_id: organization.organizationId,
        integration_id: integrationId,
        opportunity_id: transaction.opportunityId || order?.opportunityId || 'direct-sale',
        contact_id: transaction.contactId || transaction.altId || order?.contactId,
        product_id: productId,
        ghl_invoice_id: transaction.invoiceId,
        ghl_payment_id: transaction._id || transaction.id,
        ghl_transaction_id: transaction.chargeId || transaction.transactionId,
        amount: (transaction.amount || 0) / 100, // Convert from cents
        currency: transaction.currency || 'USD',
        payment_date: transaction.createdAt || transaction.created_at,
        payment_method: transaction.paymentMethod || transaction.payment_method || 'unknown',
        payment_status: 'completed', // We're only syncing successful payments
        transaction_type: transactionType,
        subscription_id: transaction.subscriptionId || transaction.subscription_id,
        is_first_payment: transaction.isFirstPayment || false,
        raw_webhook_data: {
          transaction,
          order
        }
      });
    }
    
    console.log(`Prepared ${transactionsToUpsert.length} transactions for upsert`);
    
    // Process subscriptions as recurring transactions
    for (const subscription of allSubscriptions) {
      // Get the associated opportunity/contact for attribution
      const contactId = subscription.contactId || subscription.contact_id;
      const opportunityId = subscription.opportunityId || subscription.opportunity_id || `sub-${subscription._id || subscription.id}`;
      
      // Add initial subscription transaction if needed
      const subscriptionName = subscription.recurringProduct?.product?.name || subscription.lineItemDetails?.name || 'Subscription';
      transactionsToUpsert.push({
        organization_id: organization.organizationId,
        integration_id: integrationId,
        opportunity_id: opportunityId,
        contact_id: contactId,
        ghl_payment_id: `sub-initial-${subscription._id || subscription.id}`,
        amount: subscription.amount / 100, // Convert cents to dollars
        currency: subscription.currency || 'USD',
        payment_date: subscription.subscriptionStartDate || subscription.createdAt,
        payment_method: subscription.paymentProviderType || 'subscription',
        payment_status: 'completed',
        transaction_type: 'subscription_initial',
        subscription_id: subscription.subscriptionId || subscription._id,
        is_first_payment: true,
        notes: `Initial subscription: ${subscriptionName}`
      });
      
      // Add most recent renewal if subscription has been active for multiple periods
      if (subscription.lastPaymentDate || subscription.last_payment_date) {
        transactionsToUpsert.push({
          organization_id: organization.organizationId,
          integration_id: integrationId,
          opportunity_id: opportunityId,
          contact_id: contactId,
          ghl_payment_id: `sub-renewal-${subscription._id || subscription.id}-latest`,
          amount: (subscription.amount || subscription.price || 0) / 100,
          currency: subscription.currency || 'USD',
          payment_date: subscription.lastPaymentDate || subscription.last_payment_date,
          payment_method: subscription.paymentMethod || 'subscription',
          payment_status: 'completed',
          transaction_type: 'subscription_renewal',
          subscription_id: subscription._id || subscription.id,
          is_first_payment: false,
          notes: `Subscription renewal: ${subscription.name || 'Subscription'}`
        });
      }
    }
    
    // Upsert transactions to database
    if (transactionsToUpsert.length > 0) {
      // Process in batches to avoid timeout
      const batchSize = 50;
      let successCount = 0;
      
      for (let i = 0; i < transactionsToUpsert.length; i += batchSize) {
        const batch = transactionsToUpsert.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabase
          .from('sales_transactions')
          .upsert(batch, {
            onConflict: 'integration_id,ghl_payment_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Error upserting batch:', upsertError);
        } else {
          successCount += batch.length;
        }
      }
      
      console.log(`Successfully upserted ${successCount} transactions`);
    }
    
    // Get summary of synced transactions
    const { data: summary, error: summaryError } = await supabase
      .from('sales_transactions')
      .select('payment_status, transaction_type')
      .eq('organization_id', organization.organizationId)
      .eq('integration_id', integrationId);
    
    const stats = {
      total: summary?.length || 0,
      completed: summary?.filter(t => t.payment_status === 'completed').length || 0,
      pending: summary?.filter(t => t.payment_status === 'pending').length || 0,
      subscriptions: summary?.filter(t => t.transaction_type.includes('subscription')).length || 0
    };
    
    return NextResponse.json({
      success: true,
      message: transactionsToUpsert.length > 0 
        ? `Successfully synced ${transactionsToUpsert.length} payment transactions`
        : 'No payment data found in GoHighLevel. Make sure you have paid invoices or active subscriptions.',
      stats: {
        fetched: allTransactions.length,
        invoices: allTransactions.filter(t => t.paymentMethod === 'invoice').length,
        subscriptions: allSubscriptions.length,
        synced: transactionsToUpsert.length,
        ...stats
      }
    });

  } catch (error) {
    console.error('Payment sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}