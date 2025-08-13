import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Pricing from '@/components/pricing';
import { Database } from '@/types/supabase';

export default async function PricingPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: products } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let finalProducts = products ?? [];

  if (finalProducts.length === 0) {
    finalProducts = [
      {
        id: 'prod_SrRckq8tKZflpa',
        active: true,
        name: 'Basic Access Plan',
        description: 'Get basic access with GHL integrations.',
        image: null,
        metadata: { index: 0 },
        prices: [
          {
            id: process.env.STRIPE_PRICE_ID!,
            product_id: 'prod_SrRckq8tKZflpa',
            active: true,
            description: null,
            unit_amount: 4700,
            currency: 'usd',
            type: 'recurring',
            interval: 'month',
            interval_count: 1,
            trial_period_days: null,
            metadata: {},
          },
        ],
      },
    ];
  }

  return <Pricing products={finalProducts} session={session} />;
} 