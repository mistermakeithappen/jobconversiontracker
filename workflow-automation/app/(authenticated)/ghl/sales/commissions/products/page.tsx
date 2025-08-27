'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { getSupabaseClient } from '@/lib/auth/client';
import { 
  Package, Plus, Edit2, Trash2, Save, X, 
  DollarSign, Percent, Calendar, Shield, AlertCircle,
  TrendingUp, FileText, Settings, ChevronDown, RefreshCw, CheckCircle
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  price_type: 'one_time' | 'recurring';
  billing_frequency?: string;
  is_active: boolean;
}

interface ProductCommissionRule {
  id: string;
  product_id: string;
  product?: Product;
  initial_sale_rate: number;
  renewal_rate: number;
  mrr_commission_type: 'first_payment_only' | 'duration' | 'lifetime';
  mrr_duration_months?: number;
  trailing_rate?: number;
  clawback_enabled: boolean;
  clawback_months?: number;
  min_sale_amount?: number;
  max_commission_amount?: number;
  estimated_margin_percentage?: number;
  max_commission_of_margin?: number;
  requires_manager_approval: boolean;
  approval_threshold?: number;
  is_active: boolean;
  priority: number;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
}

export default function ProductCommissionSettings() {
  const { user } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<ProductCommissionRule[]>([]);
  const [editingRule, setEditingRule] = useState<ProductCommissionRule | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'needs-reconnection'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [reconnectionReason, setReconnectionReason] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const defaultRule: Partial<ProductCommissionRule> = {
    initial_sale_rate: 10,
    renewal_rate: 5,
    mrr_commission_type: 'duration',
    mrr_duration_months: 12,
    trailing_rate: 2.5,
    clawback_enabled: true,
    clawback_months: 3,
    requires_manager_approval: false,
    is_active: true,
    priority: 0
  };

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
      fetchData();
    }
  }, [connected, hasActiveSubscription, subscriptionLoading]);

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
              ? 'Your trial period has ended. Upgrade to continue accessing commission settings and management.'
              : 'Access advanced commission structure configuration, product rules, and payout management with a premium subscription.'
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
                      successUrl: window.location.origin + '/ghl/sales/commissions/products?upgraded=true',
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
          feature="Commission Management"
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, rulesRes] = await Promise.all([
        fetch('/api/products', { credentials: 'include' }),
        fetch('/api/commissions/products', { credentials: 'include' })
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.products || []);
      }

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (rule: Partial<ProductCommissionRule>) => {
    setSaving(true);
    try {
      const url = rule.id 
        ? `/api/commissions/products?ruleId=${rule.id}`
        : '/api/commissions/products';
      
      const method = rule.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        await fetchData();
        setEditingRule(null);
        setShowCreateForm(false);
        setSelectedProduct('');
      } else {
        const error = await response.json();
        alert(`Error saving rule: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Failed to save commission rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this commission rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/commissions/products?ruleId=${ruleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert(`Error deleting rule: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete commission rule');
    }
  };

  const formatPercent = (value: number) => `${value}%`;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
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
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel to manage commissions</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Link your GHL account to configure product commission structures and rules
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Commission Settings</h1>
          <p className="text-gray-600">Configure commission rules for each product</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </span>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingRule({ ...defaultRule } as ProductCommissionRule);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingRule) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingRule?.id ? 'Edit Commission Rule' : 'Create Commission Rule'}
            </h2>
            <button
              onClick={() => {
                setEditingRule(null);
                setShowCreateForm(false);
                setSelectedProduct('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product
              </label>
              <select
                value={editingRule?.product_id || selectedProduct}
                onChange={(e) => {
                  const productId = e.target.value;
                  setSelectedProduct(productId);
                  if (editingRule) {
                    setEditingRule({ ...editingRule, product_id: productId });
                  }
                }}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={!!editingRule?.id}
              >
                <option value="">Select a product</option>
                {products.filter(p => p.is_active).map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.price_type === 'recurring' ? 'Recurring' : 'One-time'})
                  </option>
                ))}
              </select>
            </div>

            {/* Commission Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Sale Rate (%)
                </label>
                <input
                  type="number"
                  value={editingRule?.initial_sale_rate || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule!,
                    initial_sale_rate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Renewal Rate (%)
                </label>
                <input
                  type="number"
                  value={editingRule?.renewal_rate || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule!,
                    renewal_rate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trailing Rate (%)
                </label>
                <input
                  type="number"
                  value={editingRule?.trailing_rate || ''}
                  onChange={(e) => setEditingRule({
                    ...editingRule!,
                    trailing_rate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            {/* MRR Commission Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRR Commission Type
                </label>
                <select
                  value={editingRule?.mrr_commission_type || 'duration'}
                  onChange={(e) => setEditingRule({
                    ...editingRule!,
                    mrr_commission_type: e.target.value as any
                  })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="first_payment_only">First Payment Only</option>
                  <option value="duration">Duration Based</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>

              {editingRule?.mrr_commission_type === 'duration' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    value={editingRule?.mrr_duration_months || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule!,
                      mrr_duration_months: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="120"
                  />
                </div>
              )}
            </div>

            {/* Clawback Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="clawback_enabled"
                  checked={editingRule?.clawback_enabled || false}
                  onChange={(e) => setEditingRule({
                    ...editingRule!,
                    clawback_enabled: e.target.checked
                  })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="clawback_enabled" className="text-sm font-medium text-gray-700">
                  Enable Clawback
                </label>
              </div>

              {editingRule?.clawback_enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clawback Period (Months)
                  </label>
                  <input
                    type="number"
                    value={editingRule?.clawback_months || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule!,
                      clawback_months: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="24"
                  />
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                  {/* Amount Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Sale Amount
                      </label>
                      <input
                        type="number"
                        value={editingRule?.min_sale_amount || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          min_sale_amount: parseFloat(e.target.value) || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Commission Amount
                      </label>
                      <input
                        type="number"
                        value={editingRule?.max_commission_amount || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          max_commission_amount: parseFloat(e.target.value) || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="0"
                        step="0.01"
                        placeholder="No limit"
                      />
                    </div>
                  </div>

                  {/* Margin Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Margin (%)
                      </label>
                      <input
                        type="number"
                        value={editingRule?.estimated_margin_percentage || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          estimated_margin_percentage: parseFloat(e.target.value) || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Commission of Margin (%)
                      </label>
                      <input
                        type="number"
                        value={editingRule?.max_commission_of_margin || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          max_commission_of_margin: parseFloat(e.target.value) || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                  </div>

                  {/* Approval Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="requires_approval"
                        checked={editingRule?.requires_manager_approval || false}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          requires_manager_approval: e.target.checked
                        })}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="requires_approval" className="text-sm font-medium text-gray-700">
                        Requires Manager Approval
                      </label>
                    </div>

                    {editingRule?.requires_manager_approval && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Approval Threshold
                        </label>
                        <input
                          type="number"
                          value={editingRule?.approval_threshold || ''}
                          onChange={(e) => setEditingRule({
                            ...editingRule!,
                            approval_threshold: parseFloat(e.target.value) || undefined
                          })}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          min="0"
                          step="0.01"
                          placeholder="Always require"
                        />
                      </div>
                    )}
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Effective Date
                      </label>
                      <input
                        type="date"
                        value={editingRule?.effective_date || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          effective_date: e.target.value || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiration Date
                      </label>
                      <input
                        type="date"
                        value={editingRule?.expiration_date || ''}
                        onChange={(e) => setEditingRule({
                          ...editingRule!,
                          expiration_date: e.target.value || undefined
                        })}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={editingRule?.notes || ''}
                      onChange={(e) => setEditingRule({
                        ...editingRule!,
                        notes: e.target.value || undefined
                      })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                      placeholder="Additional notes about this commission rule..."
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority (Higher number = Higher priority)
                    </label>
                    <input
                      type="number"
                      value={editingRule?.priority || 0}
                      onChange={(e) => setEditingRule({
                        ...editingRule!,
                        priority: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                      max="999"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={editingRule?.is_active || false}
                onChange={(e) => setEditingRule({
                  ...editingRule!,
                  is_active: e.target.checked
                })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active Rule
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingRule(null);
                  setShowCreateForm(false);
                  setSelectedProduct('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveRule(editingRule!)}
                disabled={saving || !editingRule?.product_id}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Rule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Commission Rules</h2>
        </div>
        
        {rules.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No commission rules configured</p>
            <p className="text-sm text-gray-400 mt-2">
              Create rules to define how commissions are calculated for each product
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-gray-400" />
                      <h3 className="font-medium text-gray-900">
                        {rule.product?.name || 'Unknown Product'}
                      </h3>
                      {!rule.is_active && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Inactive
                        </span>
                      )}
                      {rule.requires_manager_approval && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Approval Required
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Initial Sale</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatPercent(rule.initial_sale_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Renewal</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatPercent(rule.renewal_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">MRR Type</p>
                        <p className="text-sm font-medium text-gray-900">
                          {rule.mrr_commission_type === 'first_payment_only' && 'First Payment'}
                          {rule.mrr_commission_type === 'duration' && `${rule.mrr_duration_months} months`}
                          {rule.mrr_commission_type === 'lifetime' && 'Lifetime'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Clawback</p>
                        <p className="text-sm font-medium text-gray-900">
                          {rule.clawback_enabled ? `${rule.clawback_months} months` : 'Disabled'}
                        </p>
                      </div>
                    </div>

                    {/* Additional Details */}
                    {(rule.min_sale_amount || rule.max_commission_amount || rule.notes) && (
                      <div className="mt-3 text-sm text-gray-600">
                        {rule.min_sale_amount && (
                          <p>Min sale: {formatCurrency(rule.min_sale_amount)}</p>
                        )}
                        {rule.max_commission_amount && (
                          <p>Max commission: {formatCurrency(rule.max_commission_amount)}</p>
                        )}
                        {rule.notes && (
                          <p className="italic">{rule.notes}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">Commission Rule Priority</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Rules with higher priority numbers are applied first</li>
              <li>Only the highest priority active rule for each product is used</li>
              <li>Date ranges (effective/expiration) are checked before applying rules</li>
              <li>Validation checks ensure commissions don't exceed product margins</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}