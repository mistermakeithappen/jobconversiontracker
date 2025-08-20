'use client';

import { useState, useEffect } from 'react';
import { Settings, CreditCard, DollarSign, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { PipelineManualSettings } from '@/components/ghl/pipeline-manual-settings';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';

export default function GHLSettingsPage() {
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [stats, setStats] = useState({
    companyCards: 0,
    activeUsers: 0,
    paymentStructures: 0,
    loading: true
  });
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  useEffect(() => {
    fetchIntegrationId();
  }, []);

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
    
    if (hasActiveSubscription) {
      fetchStats();
    }
  }, [hasActiveSubscription, subscriptionLoading]);

  // DEBUG: Show subscription values
  console.log('🔍 SETTINGS DEBUG:', {
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
            <Settings className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing advanced settings and admin tools.'
              : 'Access admin settings, payment structure configuration, and team management tools with a premium subscription.'
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
                      successUrl: window.location.origin + '/ghl/settings?upgraded=true',
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

  const fetchIntegrationId = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      
      if (response.ok && data.integration?.id) {
        setIntegrationId(data.integration.id);
      }
    } catch (error) {
      console.error('Error fetching integration ID:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [cardsResponse, usersResponse, paymentsResponse] = await Promise.all([
        fetch('/api/company-credit-cards'),
        fetch('/api/integrations/automake/users'),
        fetch('/api/user-payment-assignments')
      ]);

      const [cardsData, usersData, paymentsData] = await Promise.all([
        cardsResponse.json(),
        usersResponse.json(),
        paymentsResponse.json()
      ]);

      setStats({
        companyCards: cardsData.cards?.length || 0,
        activeUsers: usersData.users?.filter((user: { isActive?: boolean }) => user.isActive !== false)?.length || 0,
        paymentStructures: paymentsData.assignments?.length || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const settingSections = [
    {
      id: 'pipeline-revenue',
      title: 'Pipeline Revenue Settings',
      description: 'Configure which pipeline stages count toward revenue and trigger commissions',
      icon: TrendingUp,
      href: '#pipeline-revenue',
      status: 'Available'
    },
    {
      id: 'credit-cards',
      title: 'Company Credit Cards',
      description: 'Manage company credit cards for automatic reimbursable determination',
      icon: CreditCard,
      href: '/settings/credit-cards',
      status: 'Available'
    },
    {
      id: 'payment-structures',
      title: 'Employee Payment Structures',
      description: 'Configure payment structures for payroll and commission calculations',
      icon: DollarSign,
      href: '/settings/payment-structure',
      status: 'Available'
    },
    {
      id: 'user-management',
      title: 'User Management',
      description: 'Manage user access and permissions',
      icon: Users,
      href: '#',
      status: 'Coming Soon'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Settings</h2>
        <p className="text-gray-600">
          Manage company-wide settings, payment structures, and employee configurations
        </p>
      </div>

      {/* Admin Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Administrator Access</h4>
            <p className="text-sm text-blue-700 mt-1">
              These settings affect all users in your organization. Changes here will impact 
              expense tracking, payroll calculations, and financial reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingSections.map((section) => {
          const Icon = section.icon;
          const isAvailable = section.status === 'Available';
          
          return (
            <div
              key={section.id}
              className={`bg-white rounded-xl border border-gray-200 p-6 transition-all ${
                isAvailable 
                  ? 'hover:border-gray-300 hover:shadow-sm cursor-pointer' 
                  : 'opacity-60'
              }`}
            >
              {isAvailable ? (
                <Link href={section.href} className="block">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {section.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm">{section.description}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-500">{section.title}</h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {section.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm">{section.description}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.loading ? '...' : stats.companyCards}
            </p>
            <p className="text-sm text-gray-600">Company Cards</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.loading ? '...' : stats.activeUsers}
            </p>
            <p className="text-sm text-gray-600">Active Users</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.loading ? '...' : stats.paymentStructures}
            </p>
            <p className="text-sm text-gray-600">Payment Structures</p>
          </div>
        </div>
      </div>

      {/* Pipeline Revenue Settings Section */}
      {integrationId && (
        <div id="pipeline-revenue" className="scroll-mt-8 mt-8">
          <PipelineManualSettings integrationId={integrationId} />
        </div>
      )}

      {/* Future Features */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coming Soon</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-900">Multi-User Management</h4>
              <p className="text-sm text-gray-600">Manage payment structures for multiple employees</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-900">Automated Payroll Integration</h4>
              <p className="text-sm text-gray-600">Connect with payroll systems for automatic calculations</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-900">Commission Tracking</h4>
              <p className="text-sm text-gray-600">Automatic commission calculations based on profit margins</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-900">Advanced Reporting</h4>
              <p className="text-sm text-gray-600">Comprehensive financial reports and analytics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <Link
            href="/settings/credit-cards"
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <CreditCard className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Add Company Credit Card</span>
            </div>
            <span className="text-sm text-gray-500">→</span>
          </Link>
          
          <Link
            href="/settings/payment-structure"
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Set Up Payment Structure</span>
            </div>
            <span className="text-sm text-gray-500">→</span>
          </Link>
        </div>
      </div>

      {/* Paywall Modal - Non-dismissible */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => {}} // Prevent dismissal
        feature="GHL Settings"
        trialEnded={trialEnded}
      />
    </div>
  );
}