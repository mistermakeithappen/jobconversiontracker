'use client';

import { useState } from 'react';
import { Crown, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PaywallBannerProps {
  message?: string;
  trialEnded?: boolean;
  onDismiss?: () => void;
  dismissible?: boolean;
}

export function PaywallBanner({ 
  message = 'Upgrade to access full GHL services', 
  trialEnded = false,
  onDismiss,
  dismissible = true 
}: PaywallBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleUpgrade = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // If no price ID is configured, redirect to pricing page
      if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
        router.push('/pricing');
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      setLoading(false);
      // Fallback to pricing page
      router.push('/pricing');
    }
  };

  const handleViewPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/pricing');
  };

  return (
    <div className={`${trialEnded 
      ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-200' 
      : 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-yellow-200'
    } shadow-lg`}>
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center">
            <div className={`${trialEnded 
              ? 'bg-red-400/30' 
              : 'bg-yellow-400/30'
            } rounded-full p-2 mr-4`}>
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {trialEnded ? '🚨 Trial Expired' : '✨ Premium Feature'}
              </p>
              <p className="text-sm text-white/90">
                {message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="bg-white/20 backdrop-blur-sm text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/30 hover:scale-105 flex items-center disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  Upgrade Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
            
            <button
              onClick={handleViewPricing}
              className="text-sm text-white/80 hover:text-white underline underline-offset-2 transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
      
      {/* Subtle bottom border effect */}
      <div className={`h-0.5 ${trialEnded 
        ? 'bg-gradient-to-r from-red-300 to-red-400' 
        : 'bg-gradient-to-r from-yellow-300 to-amber-400'
      }`}></div>
    </div>
  );
}
