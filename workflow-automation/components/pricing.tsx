'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStripe } from '@/lib/stripe/client';
import { postData } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Session } from '@supabase/supabase-js';
import { Check } from 'lucide-react';
import ForGHLUsersSection from '@/components/landing/ForGHLUsersSection';
import ROISection from '@/components/landing/ROISection';
import CTASection from '@/components/landing/CTASection';

type Price = any;

interface PricingProps {
  products: {
    id: string;
    name: string;
    description: string;
    prices: Price[];
  }[];
  session: Session | null;
}

export default function Pricing({ products, session }: PricingProps) {
  const router = useRouter();
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const { user, loading: isLoading } = useAuth();

  const handleCheckout = async (price: Price) => {
    setPriceIdLoading(price.id);
    if (!user) {
      return router.push('/signin');
    }

    try {
      const { sessionId } = await postData({
        url: '/api/create-checkout-session',
        data: { price },
      });

      const stripe = await getStripe();
      stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      return alert((error as Error)?.message);
    } finally {
      setPriceIdLoading(undefined);
    }
  };

  return (
    <>
      <section className="bg-gray-50 dark:bg-gray-900">
        <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
          <div className="mx-auto max-w-screen-md text-center mb-8 lg:mb-12">
            <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
              Simple, Transparent Pricing
            </h2>
            <p className="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">
              Choose the plan that's right for your business.
            </p>
          </div>
          <div className="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-10 lg:space-y-0">
            {products.map((product) => {
              const price = product.prices[0];
              return (
                <Card key={product.id} className="flex flex-col rounded-2xl shadow-lg">
                  <CardHeader className="text-center bg-gray-100 dark:bg-gray-800 rounded-t-2xl p-6">
                    <CardTitle className="text-2xl font-bold">{product.name}</CardTitle>
                    <CardDescription className="text-gray-500">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow p-6">
                    <div className="flex justify-center items-baseline my-8">
                      <span className="mr-2 text-5xl font-extrabold text-gray-900 dark:text-white">
                        {price.unit_amount
                          ? `$${price.unit_amount / 100}`
                          : 'Free'}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        /{price.interval}
                      </span>
                    </div>
                    <ul className="space-y-4 text-left">
                      <li className="flex items-center space-x-3">
                        <Check className="w-5 h-5 text-green-500" />
                        <span>GHL Integration</span>
                      </li>
                      <li className="flex items-center space-x-3">
                        <Check className="w-5 h-5 text-green-500" />
                        <span>Basic Access</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-6 bg-gray-100 dark:bg-gray-800 rounded-b-2xl">
                    <Button
                      onClick={() => handleCheckout(price)}
                      disabled={isLoading}
                      className="w-full text-lg py-3"
                    >
                      {priceIdLoading === price.id ? 'Loading...' : 'Subscribe'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
        <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
          <div className="mx-auto max-w-screen-md text-center mb-8 lg:mb-12">
            <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
              For GHL Users
            </h2>
            <p className="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">
              Integrate with GoHighLevel to automate your workflow.
            </p>
          </div>
          </div>
      </section>
      <ForGHLUsersSection />
      <ROISection />
      <CTASection />
    </>
  );
} 