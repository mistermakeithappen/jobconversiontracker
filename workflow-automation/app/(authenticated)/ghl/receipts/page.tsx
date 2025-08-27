'use client';

import { useState, useEffect } from 'react';
import { Receipt as ReceiptIcon, MessageSquare, Camera, Smartphone, RefreshCw, CheckCircle, Plus, TrendingUp, Eye, Calendar, DollarSign, Building, Check, User } from 'lucide-react';
import Link from 'next/link';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { ComingSoonBadge } from '@/components/ui/ComingSoonBadge';

interface Receipt {
  id: string;
  vendor_name: string;
  amount: number;
  receipt_date?: string;
  category?: string;
  is_reimbursable?: boolean;
  reimbursement_status?: string;
  opportunity_id?: string;
  opportunity_name?: string;
  created_at: string;
  image_url?: string;
  description?: string;
  receipt_number?: string;
  notes?: string;
  submitted_by?: string;
  payment_method?: string;
  last_four_digits?: string;
}

export default function GHLReceiptsPage() {
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  
  // Sample data for preview mode
  const [stats] = useState({
    totalReceipts: 12,
    totalReimbursable: 8,
    totalNonReimbursable: 3,
    totalReimbursed: 1
  });

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
  }, [hasActiveSubscription, subscriptionLoading]);

  // DEBUG: Show subscription values
  console.log('🔍 RECEIPTS DEBUG:', {
    subscriptionLoading,
    hasActiveSubscription,
    trialEnded,
    shouldBlock: !subscriptionLoading && !hasActiveSubscription
  });

  // Don't show content if no subscription - BLOCK CONTENT
  if (!subscriptionLoading && !hasActiveSubscription) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ReceiptIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing AI-powered receipt processing.'
              : 'Access powerful AI receipt processing, SMS automation, and expense tracking with a premium subscription.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={async () => {
                try {
                  if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
                    window.location.href = '/pricing';
                    return;
                  }

                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
                      successUrl: window.location.origin + '/ghl/receipts?upgraded=true',
                      cancelUrl: window.location.href,
                    }),
                  });

                  if (!response.ok) throw new Error('Failed to create checkout session');
                  const { url } = await response.json();
                  if (url) {
                    window.location.href = url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (error) {
                  console.error('Error creating checkout session:', error);
                  window.location.href = '/pricing';
                }
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors border border-gray-300"
            >
              View Pricing
            </button>
          </div>
        </div>

      </div>
    );
  }

  // Always show coming soon interface when user has subscription
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">🎯 AI Receipt Processing</h2>
        <div className="flex items-center justify-center gap-2 mb-4">
          <p className="text-xl text-gray-600">The future of expense automation is almost here!</p>
          <ComingSoonBadge size="md" />
        </div>
      </div>

      {/* Coming Soon Interface */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-dashed border-purple-300 rounded-3xl p-12 text-center relative overflow-hidden">
        {/* Decorative Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-8 left-8 text-yellow-400 opacity-30">
            <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div className="absolute top-16 right-12 text-purple-400 opacity-40">
            <svg className="w-4 h-4 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div className="absolute bottom-12 left-16 text-pink-400 opacity-30">
            <svg className="w-5 h-5 animate-pulse" style={{animationDelay: '0.5s'}} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div className="absolute top-24 left-1/2 text-indigo-400 opacity-25">
            <svg className="w-3 h-3 animate-bounce" style={{animationDelay: '1s'}} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div className="absolute bottom-20 right-8 text-yellow-400 opacity-35">
            <svg className="w-4 h-4 animate-pulse" style={{animationDelay: '1.5s'}} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10">
          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="flex items-center space-x-1">
              <ReceiptIcon className="w-8 h-8 text-white" />
              <svg className="w-6 h-6 text-yellow-300 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
          
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            ✨ Something Amazing is Coming! ✨
          </h3>
          
          <p className="text-xl text-gray-700 mb-6 max-w-2xl mx-auto">
            Our AI-powered receipt processing system is being crafted with love and precision. Get ready for magical automation that will transform how you handle expenses!
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <span className="inline-flex items-center px-4 py-2 bg-white/60 backdrop-blur-sm text-purple-700 rounded-full text-sm font-medium shadow-sm border border-purple-200">
              🤖 GPT-4 Vision Processing
            </span>
            <span className="inline-flex items-center px-4 py-2 bg-white/60 backdrop-blur-sm text-purple-700 rounded-full text-sm font-medium shadow-sm border border-purple-200">
              📱 SMS Integration
            </span>
            <span className="inline-flex items-center px-4 py-2 bg-white/60 backdrop-blur-sm text-purple-700 rounded-full text-sm font-medium shadow-sm border border-purple-200">
              🎯 Smart Job Matching
            </span>
            <span className="inline-flex items-center px-4 py-2 bg-white/60 backdrop-blur-sm text-purple-700 rounded-full text-sm font-medium shadow-sm border border-purple-200">
              ⚡ Real-time Processing
            </span>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-600 mb-4">
              🚀 <strong>Coming Soon</strong> - We're putting the finishing touches on this incredible feature
            </p>
          </div>
        </div>
      </div>


      {/* Paywall Modal - Non-dismissible */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => {}} // Prevent dismissal
        feature="GHL Receipt Processing"
        trialEnded={trialEnded}
      />
    </div>
  );
}