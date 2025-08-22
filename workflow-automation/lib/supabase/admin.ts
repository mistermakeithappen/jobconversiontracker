import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Database } from '@/types/supabase';
import { Price, Product } from '@/types/stripe';

const toDateTime = (secs: number) => {
  const t = new Date('1970-01-01T00:00:00Z');
  t.setSeconds(secs);
  return t;
};

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const upsertProductRecord = async (product: Stripe.Product) => {
  const productData: Product = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? null,
    image: product.images?.[0] ?? null,
    metadata: product.metadata,
  };

  const { error } = await supabaseAdmin.from('products').upsert([productData]);
  if (error) throw error;

};

export const upsertPriceRecord = async (price: Stripe.Price) => {
  const priceData: Price = {
    id: price.id,
    product_id: typeof price.product === 'string' ? price.product : price.product.id,
    active: price.active,
    currency: price.currency,
    description: price.nickname ?? null,
    type: price.type,
    unit_amount: price.unit_amount ?? null,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    metadata: price.metadata,
  };

  const { error } = await supabaseAdmin.from('prices').upsert([priceData]);
  if (error) throw error;

};

export const createOrRetrieveCustomer = async ({
  email,
  uuid,
}: {
  email: string;
  uuid: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', uuid)
    .single();
  if (error || !data?.stripe_customer_id) {
    const customerData: { metadata: { supabaseUUID: string }; email?: string } = {
      metadata: {
        supabaseUUID: uuid,
      },
    };
    if (email) customerData.email = email;
    const customer = await stripe.customers.create(customerData);
    const { error: supabaseError } = await supabaseAdmin
      .from('customers')
      .insert([{ id: uuid, stripe_customer_id: customer.id }]);
    if (supabaseError) throw supabaseError;

    return customer.id;
  }
  return data.stripe_customer_id;
};

export const copyBillingDetailsToCustomer = async (
  uuid: string,
  payment_method: Stripe.PaymentMethod
) => {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  await stripe.customers.update(customer, {
    name: name ?? undefined,
    phone: phone ?? undefined,
    address: address
      ? {
          city: address.city ?? undefined,
          country: address.country ?? undefined,
          line1: address.line1 ?? undefined,
          line2: address.line2 ?? undefined,
          postal_code: address.postal_code ?? undefined,
          state: address.state ?? undefined,
        }
      : undefined,
  });
  
  // Update user table with billing details (now that columns exist)
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        billing_address: address ? { ...address } : null,
        payment_method: { ...payment_method[payment_method.type] },
      })
      .eq('id', uuid);
    
    if (error) {
      console.warn(`⚠️ Failed to update user billing details: ${error.message}`);
      // Don't throw - Stripe customer update succeeded, which is most important
    } else {

    }
  } catch (err) {
    console.warn(`⚠️ User billing update error: ${err}`);
  }
  

};

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {

  
  const { data: customerData, error: noCustomerError } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  if (noCustomerError) {
    console.error(`❌ Customer lookup failed:`, noCustomerError);
    throw noCustomerError;
  }

  const { id: uuid } = customerData!;


  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method', 'items.data.price.product'],
  });
  




  // Calculate billing periods from billing_cycle_anchor
  const billingCycleAnchor = (subscription as any).billing_cycle_anchor;

  // Calculate current period start and end from billing cycle anchor
  let currentPeriodStart = null;
  let currentPeriodEnd = null;
  
  if (billingCycleAnchor) {
    // FIXED: billing_cycle_anchor is the subscription START date, not next billing date
    // We need to calculate the NEXT billing date from the start date + intervals
    
    const subscriptionStartDate = new Date(billingCycleAnchor * 1000);
    const priceInterval = subscription.items.data[0].price.recurring?.interval || 'month';
    const intervalCount = subscription.items.data[0].price.recurring?.interval_count || 1;
    
    // Calculate the next billing date by adding intervals from start date
    const nextBillingDate = new Date(subscriptionStartDate);
    
    // Add one billing period to get the next billing date  
    if (priceInterval === 'month') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + intervalCount);
    } else if (priceInterval === 'year') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + intervalCount);
    } else if (priceInterval === 'day') {
      nextBillingDate.setDate(nextBillingDate.getDate() + intervalCount);
    } else if (priceInterval === 'week') {
      nextBillingDate.setDate(nextBillingDate.getDate() + (intervalCount * 7));
    }
    
    // Current period end is the next billing date
    currentPeriodEnd = Math.floor(nextBillingDate.getTime() / 1000);
    
    // Current period start is the subscription start date
    currentPeriodStart = billingCycleAnchor;
    

  }
  


  // Ensure price and product records exist
  const priceItem = subscription.items.data[0];
  const stripePrice = priceItem.price;
  const stripeProduct = stripePrice.product as any;



  try {
    // First, ensure the product exists
    if (stripeProduct && typeof stripeProduct === 'object') {
      await upsertProductRecord(stripeProduct);

    } else if (typeof stripeProduct === 'string') {
      // If product is just an ID, fetch it from Stripe
      const fullProduct = await stripe.products.retrieve(stripeProduct);
      await upsertProductRecord(fullProduct);

    }

    // Then, ensure the price exists
    await upsertPriceRecord(stripePrice);

  } catch (error) {
    console.error(`❌ Failed to ensure price/product records:`, error);
    // Continue anyway - the upsert might still work if records exist
  }

  // Helper function to safely convert timestamps
  const safeToDateTime = (timestamp: any, fieldName: string) => {
    if (!timestamp || timestamp === null || timestamp === undefined) {
      return null;
    }
    try {
      return toDateTime(timestamp).toISOString();
    } catch (error) {
      console.error(`❌ Failed to convert ${fieldName}:`, timestamp, error);
      return null;
    }
  };

  const subscriptionData = {
    id: subscription.id,
    user_id: uuid,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    quantity: subscription.items.data[0].quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: safeToDateTime(subscription.cancel_at, 'cancel_at'),
    canceled_at: safeToDateTime(subscription.canceled_at, 'canceled_at'),
    current_period_start: safeToDateTime(currentPeriodStart, 'current_period_start'),
    current_period_end: safeToDateTime(currentPeriodEnd, 'current_period_end'),
    ended_at: safeToDateTime(subscription.ended_at, 'ended_at'),
    trial_start: safeToDateTime(subscription.trial_start, 'trial_start'),
    trial_end: safeToDateTime(subscription.trial_end, 'trial_end'),
  };



  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert([subscriptionData]);
  if (error) {
    console.error(`❌ Subscription upsert failed:`, error);
    throw error;
  }
  


  if (createAction && subscription.default_payment_method && uuid)
    await copyBillingDetailsToCustomer(
      uuid,
      subscription.default_payment_method as Stripe.PaymentMethod
    );
}; 