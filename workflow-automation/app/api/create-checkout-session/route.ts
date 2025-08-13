import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createOrRetrieveCustomer } from '@/lib/supabase/admin';
import { getURL } from '@/lib/utils/helpers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function POST(req: Request) {
  if (req.method === 'POST') {
    const { price, quantity = 1, metadata = {} } = await req.json();

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
            price: price.id,
            quantity,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          metadata,
        },
        success_url: `${getURL()}settings/billing`,
        cancel_url: `${getURL()}pricing`,
      });

      return NextResponse.json({ sessionId: session.id });
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