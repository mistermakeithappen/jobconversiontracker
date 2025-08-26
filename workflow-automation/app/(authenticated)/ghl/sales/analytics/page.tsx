'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { getSupabaseClient } from '@/lib/auth/client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Package, TrendingUp, Users, DollarSign, Award, Clock, 
  Filter, Download, RefreshCw, ChevronDown, CheckCircle, Plus
} from 'lucide-react';

interface ProductAnalytics {
  summary: {
    totalRevenue: number;
    totalUnits: number;
    totalCommissions: number;
    uniqueProducts: number;
    topProduct: any;
    topSalesPerson: any;
    averageCommissionRate: number;
  };
  products: Array<{
    productId: string;
    product: any;
    unitsSold: number;
    totalRevenue: number;
    averageSalePrice: number;
    uniqueCustomers: number;
    commissionsPaid: number;
    commissionRate: number;
    topSalesPeople: any[];
    salesVelocity: number;
  }>;
  salesPeople?: Array<{
    memberId: string;
    member: any;
    totalRevenue: number;
    totalUnits: number;
    commissionEarned: number;
    commissionRate: number;
    productBreakdown: any[];
    uniqueProducts: number;
    averageOrderValue: number;
  }>;
  timeSeries: Array<{
    date: string;
    revenue: number;
    units: number;
    transactions: number;
  }>;
}

const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

export default function ProductAnalyticsDashboard() {
  const { user } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [dateRange, setDateRange] = useState('30days');
  const [groupBy, setGroupBy] = useState<'product' | 'salesperson'>('product');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'needs-reconnection'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [reconnectionReason, setReconnectionReason] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
    
    if (connected && hasActiveSubscription) {
      fetchAnalytics();
    }
  }, [connected, hasActiveSubscription, subscriptionLoading, dateRange, groupBy, selectedProduct]);

  // Don't show content if no subscription - BLOCK CONTENT
  if (!subscriptionLoading && !hasActiveSubscription) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing product analytics and insights.'
              : 'Access powerful product analytics, sales performance tracking, and commission insights with a premium subscription.'
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
                      successUrl: window.location.origin + '/ghl/sales/analytics?upgraded=true',
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

        {/* Paywall Modal - Non-dismissible */}
        <PaywallModal
          isOpen={showPaywallModal}
          onClose={() => {}} // Prevent dismissal
          feature="Product Analytics"
          trialEnded={trialEnded}
        />
      </div>
    );
  }

  const checkConnectionStatus = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/status', {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      const data = await response.json();
      
      if (data.needsReconnection) {
        setConnectionStatus('needs-reconnection');
        setReconnectionReason(data.reconnectionReason || 'Your GoHighLevel connection needs to be re-authorized.');
        setConnected(false);
      } else {
        setConnected(data.connected);
        setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      }
      
      if (data.integrationId) {
        setIntegrationId(data.integrationId);
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleConnect = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/connect', {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      const data = await response.json();

      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('Failed to initiate connection to GoHighLevel');
      }
    } catch (error) {
      console.error('Error connecting to GHL:', error);
      alert('Error connecting to GoHighLevel');
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange,
        groupBy,
        ...(selectedProduct && { productId: selectedProduct })
      });

      const response = await fetch(`/api/analytics/products?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const exportData = () => {
    if (!analytics) return;

    const csvContent = [
      ['Product Analytics Report', `Date Range: ${dateRange}`],
      [],
      ['Summary'],
      ['Total Revenue', analytics.summary.totalRevenue],
      ['Total Units', analytics.summary.totalUnits],
      ['Total Commissions', analytics.summary.totalCommissions],
      ['Average Commission Rate', analytics.summary.averageCommissionRate],
      [],
      ['Product Details'],
      ['Product', 'Units Sold', 'Revenue', 'Avg Price', 'Commission Rate', 'Sales Velocity'],
      ...analytics.products.map(p => [
        p.product?.name || 'Unknown',
        p.unitsSold,
        p.totalRevenue,
        p.averageSalePrice,
        p.commissionRate,
        p.salesVelocity
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (connectionStatus === 'checking') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Checking connection status...</p>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel to view analytics</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Link your GHL account to access product analytics and sales insights
        </p>
        <button
          onClick={handleConnect}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Connect GoHighLevel</span>
        </button>
      </div>
    );
  }

  if (connectionStatus === 'needs-reconnection') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">GoHighLevel Reconnection Required</h3>
          <p className="text-gray-600 mb-6">
            {reconnectionReason}
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reconnect to GoHighLevel</span>
          </button>
          <p className="text-sm text-gray-500 mt-4">
            You will be redirected to GoHighLevel to re-authorize the connection
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Performance Analytics</h1>
          <p className="text-gray-600">Track product sales, velocity, and commission metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.summary.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Units Sold</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.totalUnits.toLocaleString()}
              </p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Commission Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercent(analytics.summary.averageCommissionRate)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.uniqueProducts}
              </p>
            </div>
            <Award className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.timeSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#8B5CF6" 
              strokeWidth={2}
              name="Revenue"
            />
            <Line 
              type="monotone" 
              dataKey="units" 
              stroke="#10B981" 
              strokeWidth={2}
              name="Units"
              yAxisId="right"
            />
            <YAxis yAxisId="right" orientation="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.products.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="product.name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="totalRevenue" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Velocity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.products.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="product.name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value.toFixed(2)} units/day`} />
              <Bar dataKey="salesVelocity" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Product Performance Details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupBy('product')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  groupBy === 'product' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Product
              </button>
              <button
                onClick={() => setGroupBy('salesperson')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  groupBy === 'salesperson' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Salesperson
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Product' : 'Sales Person'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Avg Price' : 'Avg Order'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Velocity' : 'Products'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Performer
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groupBy === 'product' ? (
                analytics.products.map((product) => (
                  <tr key={product.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {product.product?.name || 'Unknown Product'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.uniqueCustomers} customers
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unitsSold.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(product.averageSalePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {formatPercent(product.commissionRate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.salesVelocity.toFixed(2)}/day
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.topSalesPeople[0] ? (
                        <div>
                          <div className="font-medium">
                            {product.topSalesPeople[0].member?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(product.topSalesPeople[0].revenue)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                analytics.salesPeople?.map((person) => (
                  <tr key={person.memberId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-5 h-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {person.member?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {person.member?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.totalUnits.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(person.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(person.averageOrderValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {formatPercent(person.commissionRate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.uniqueProducts} products
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.productBreakdown[0] ? (
                        <div>
                          <div className="font-medium">
                            {person.productBreakdown[0].product?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(person.productBreakdown[0].revenue)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}