import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createOrRetrieveCustomer } from '@/lib/supabase/admin';
import { getURL } from '@/lib/utils/helpers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function POST(req: Request) {
  if (req.method === 'POST') {
    const { price, priceId, quantity = 1, metadata = {}, successUrl, cancelUrl } = await req.json();
    
    console.log('💳 Create checkout session request:', { 
      priceId, 
      actualPriceId: price?.id || priceId,
      successUrl,
      cancelUrl,
      quantity 
    });
    
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

      console.log('🔐 Getting user from session...');
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('❌ User auth error:', userError);
        return new NextResponse(`Authentication error: ${userError.message}`, { status: 401 });
      }

      if (!user) {
        console.error('❌ No user found in session');
        return new NextResponse('User not found - please sign in', { status: 401 });
      }

      console.log('✅ User authenticated:', { id: user.id, email: user.email });

      if (!actualPriceId) {
        console.error('❌ No price ID provided');
        return new NextResponse('Price ID is required', { status: 400 });
      }

      console.log('🏷️ Using price ID:', actualPriceId);

      console.log('👤 Creating or retrieving Stripe customer...');
      const customer = await createOrRetrieveCustomer({
        uuid: user.id || '',
        email: user.email || '',
      });

      if (!customer) {
        console.error('❌ Failed to create/retrieve customer');
        return new NextResponse('Failed to create customer', { status: 500 });
      }

      console.log('✅ Customer ready:', customer);

      console.log('🏪 Creating Stripe checkout session...');

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
        success_url: successUrl || `${getURL()}ghl?upgraded=true`,
        cancel_url: cancelUrl || `${getURL()}pricing`,
      });

      console.log('✅ Checkout session created:', { id: session.id, url: session.url });

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