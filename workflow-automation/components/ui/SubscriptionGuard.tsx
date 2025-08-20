'use client';

import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from './PaywallModal';
import Link from 'next/link';
import { Crown } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  feature: string;
  icon?: ReactNode;
  description?: string;
}

export function SubscriptionGuard({ 
  children, 
  feature, 
  icon = <Crown className="w-10 h-10 text-white" />,
  description = `Access to ${feature} requires an active subscription.`
}: SubscriptionGuardProps) {
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();

  // Show loading state while checking subscription
  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // Block access if no active subscription
  if (!hasActiveSubscription) {
    return (
      <>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            {icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Premium Feature'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={async () => {
                try {
                  // If no price ID is configured, redirect to pricing page
                  if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
                    window.location.href = '/pricing';
                    return;
                  }

                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
                      successUrl: window.location.origin + '/ghl?upgraded=true',
                      cancelUrl: window.location.href,
                    }),
                  });

                  if (!response.ok) {
                    throw new Error('Failed to create checkout session');
                  }

                  const { url } = await response.json();
                  if (url) {
                    window.location.href = url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (error) {
                  console.error('Error creating checkout session:', error);
                  // Fallback to pricing page
                  window.location.href = '/pricing';
                }
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upgrade Now
            </button>
            <Link
              href="/pricing"
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors border border-gray-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
        
        {/* Non-dismissible modal as additional barrier */}
        <PaywallModal
          isOpen={true}
          onClose={() => {}} // Prevent dismissal
          feature={feature}
          trialEnded={trialEnded}
        />
      </>
    );
  }

  // Render children if subscription is active
  return <>{children}</>;
}
