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
  console.log(`Product inserted/updated: ${product.id}`);
};

export const upsertPriceRecord = async (price: Stripe.Price) => {
  const priceData: Price = {
    id: price.id,
    product_id: typeof price.product === 'string' ? price.product : '',
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
  console.log(`Price inserted/updated: ${price.id}`);
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
    console.log(`New customer created and inserted for ${uuid}.`);
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
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      billing_address: address ? { ...address } : null,
      payment_method: { ...payment_method[payment_method.type] },
    })
    .eq('id', uuid);
  if (error) throw error;
};

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  console.log(`🔄 Managing subscription: ${subscriptionId} for customer: ${customerId}`);
  
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
  console.log(`✅ Found customer UUID: ${uuid}`);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });
  
  console.log(`✅ Retrieved subscription:`, {
    id: subscription.id,
    status: subscription.status,
    current_period_start: (subscription as any).current_period_start,
    current_period_end: (subscription as any).current_period_end,
    cancel_at: subscription.cancel_at,
    canceled_at: subscription.canceled_at,
    trial_start: subscription.trial_start,
    trial_end: subscription.trial_end,
    ended_at: subscription.ended_at
  });

  // Helper function to safely convert timestamps
  const safeToDateTime = (timestamp: any, fieldName: string) => {
    if (!timestamp || timestamp === null || timestamp === undefined) {
      console.log(`⚠️ ${fieldName} is null/undefined, skipping`);
      return null;
    }
    try {
      const result = toDateTime(timestamp).toISOString();
      console.log(`✅ Converted ${fieldName}: ${timestamp} -> ${result}`);
      return result;
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
    current_period_start: safeToDateTime((subscription as any).current_period_start, 'current_period_start'),
    current_period_end: safeToDateTime((subscription as any).current_period_end, 'current_period_end'),
    ended_at: safeToDateTime(subscription.ended_at, 'ended_at'),
    trial_start: safeToDateTime(subscription.trial_start, 'trial_start'),
    trial_end: safeToDateTime(subscription.trial_end, 'trial_end'),
  };

  console.log(`🔄 Upserting subscription data:`, subscriptionData);

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert([subscriptionData]);
  if (error) {
    console.error(`❌ Subscription upsert failed:`, error);
    throw error;
  }
  
  console.log(`✅ Inserted/updated subscription [${subscription.id}] for user [${uuid}]`);

  if (createAction && subscription.default_payment_method && uuid)
    await copyBillingDetailsToCustomer(
      uuid,
      subscription.default_payment_method as Stripe.PaymentMethod
    );
}; 