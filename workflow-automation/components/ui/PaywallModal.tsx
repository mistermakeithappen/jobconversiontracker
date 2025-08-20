'use client';

import { useState } from 'react';
import { X, Crown, Check, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  trialEnded?: boolean;
}

export function PaywallModal({ isOpen, onClose, feature = 'GHL services', trialEnded = false }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // If no price ID is configured, redirect to pricing page
      if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
        router.push('/pricing');
        return;
      }

      // Create Stripe checkout session
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

  const handleViewPricing = () => {
    router.push('/pricing');
  };

  return (
    <>
      {/* Full screen overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh',
          margin: 0,
          padding: 0,
          zIndex: 9999
        }}
      />
      
      {/* Modal container */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh',
          margin: 0,
          zIndex: 10000
        }}
      >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Crown className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              {trialEnded ? 'Trial Expired' : 'Premium Feature'}
            </h2>
          </div>
          {/* Remove close button - modal should not be dismissible without subscription */}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-white" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {trialEnded 
                ? 'Your trial period has ended' 
                : `Upgrade to access ${feature}`
              }
            </h3>
            
            <p className="text-gray-600 mb-6">
              {trialEnded
                ? 'Continue enjoying all GoHighLevel integration features with a paid subscription.'
                : 'Access powerful GoHighLevel integrations, commission tracking, and automation tools with our premium plan.'
              }
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Full GoHighLevel Integration</span>
            </div>
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Commission Tracking & Management</span>
            </div>
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Contact & Opportunity Sync</span>
            </div>
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Receipt Processing & AI Analysis</span>
            </div>
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-3" />
              <span className="text-gray-700">Pipeline Analytics & Reports</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  Upgrade Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
            
            <button
              onClick={handleViewPricing}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
