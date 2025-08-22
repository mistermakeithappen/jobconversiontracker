'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function SalesDashboard() {
  const { user } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingAmount: 0,
    monthlyGrowth: 0,
    activeProducts: 0,
    topProducts: [] as any[]
  });

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
    
    if (user && hasActiveSubscription) {
      fetchDashboardData();
    }
  }, [user, hasActiveSubscription, subscriptionLoading]);

  // DEBUG: Show subscription values
  console.log('🔍 SALES DEBUG:', {
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
            <DollarSign className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing sales tracking and commission analytics.'
              : 'Access comprehensive sales dashboards, commission tracking, and revenue analytics with a premium subscription.'
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
                      successUrl: window.location.origin + '/ghl/sales?upgraded=true',
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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch invoice data from commission_events
      const invoicesRes = await fetch('/api/sales/invoices', {
        credentials: 'include'
      });

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        const { invoices, stats } = data;

        // Calculate monthly revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const thisMonthRevenue = invoices
          .filter((i: any) => new Date(i.invoice_date) >= startOfMonth && i.status === 'paid')
          .reduce((sum: number, i: any) => sum + i.amount_paid, 0);

        const lastMonthRevenue = invoices
          .filter((i: any) => {
            const date = new Date(i.invoice_date);
            return date >= startOfLastMonth && date < startOfMonth && i.status === 'paid';
          })
          .reduce((sum: number, i: any) => sum + i.amount_paid, 0);

        const growth = lastMonthRevenue > 0 
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
          : 0;

        setMetrics({
          totalRevenue: stats.totalPaid || 0,
          monthlyRevenue: thisMonthRevenue,
          totalInvoices: stats.totalInvoices || 0,
          paidInvoices: stats.byStatus?.paid || 0,
          pendingAmount: stats.totalDue || 0,
          monthlyGrowth: growth,
          activeProducts: 0, // Will be populated if we add product fetching
          topProducts: []
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading sales data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.monthlyRevenue)}</p>
              <div className="flex items-center mt-1">
                {metrics.monthlyGrowth >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${metrics.monthlyGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercentage(metrics.monthlyGrowth)}
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.paidInvoices}</p>
              <p className="text-sm text-gray-500">of {metrics.totalInvoices} total</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.pendingAmount)}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
        <div className="h-64 flex items-center justify-center text-gray-400">
          <p>Revenue chart will be displayed here</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/ghl/sales/invoices"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">View Invoices</h3>
          <p className="text-sm text-gray-600">Manage and track all invoices</p>
        </a>
        
        <a
          href="/ghl/sales/estimates"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">View Estimates</h3>
          <p className="text-sm text-gray-600">Track estimates and conversions</p>
        </a>
        
        <a
          href="/ghl/sales/products"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">Manage Products</h3>
          <p className="text-sm text-gray-600">View and sync products from GoHighLevel</p>
        </a>
      </div>

      {/* Paywall Modal - Non-dismissible */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => {}} // Prevent dismissal
        feature="GHL Sales Dashboard"
        trialEnded={trialEnded}
      />
    </div>
  );
}