import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createOrRetrieveCustomer } from '@/lib/supabase/admin';
import { getURL } from '@/lib/utils/helpers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function POST(req: Request) {
  if (req.method === 'POST') {
    const { price, priceId, quantity = 1, metadata = {} } = await req.json();
    
    // Handle both price object and priceId string for backward compatibility
    const actualPriceId = price?.id || priceId;

    try {
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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return new NextResponse('User not found', { status: 404 });
      }

      if (!actualPriceId) {
        return new NextResponse('Price ID is required', { status: 400 });
      }

      const customer = await createOrRetrieveCustomer({
        uuid: user.id || '',
        email: user.email || '',
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        customer,
        line_items: [
          {
            price: actualPriceId,
            quantity,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          metadata,
        },
        success_url: `${getURL()}ghl?upgraded=true`,
        cancel_url: `${getURL()}ghl`,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      return new NextResponse(`Something went wrong: ${err.message}`, { status: 500 });
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: { Allow: 'POST' },
      status: 405,
    });
  }
} 