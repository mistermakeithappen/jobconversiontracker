'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, AlertCircle, CheckCircle, DollarSign, Users, RefreshCw, Edit2, Trash2, X, Plus } from 'lucide-react';
import Link from 'next/link';

interface GHLUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  isActive?: boolean;
}

interface UserCommission {
  id: string;
  ghl_user_id: string;
  user_name: string;
  user_email: string;
  commission_type: string;
  commission_percentage: number;
  subscription_commission_percentage: number;
  subscription_commission_type: string;
  subscription_duration_months?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const COMMISSION_TYPES = [
  { value: 'gross', label: 'Gross Revenue', description: 'Percentage of total revenue' },
  { value: 'profit', label: 'Net Profit', description: 'Percentage of profit after expenses' },
  { value: 'tiered', label: 'Tiered', description: 'Different rates at different revenue levels' },
  { value: 'flat', label: 'Flat Rate', description: 'Fixed amount per sale' }
];

const SUBSCRIPTION_COMMISSION_TYPES = [
  { value: 'first_payment_only', label: 'First Payment Only', description: 'Commission on initial payment only' },
  { value: 'all_payments', label: 'All Payments', description: 'Commission on every subscription payment' },
  { value: 'duration_based', label: 'Duration Based', description: 'Commission for a specific number of months' }
];

export default function GHLUserCommissionsPage() {
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  const [commissions, setCommissions] = useState<UserCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<GHLUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ghlConnected, setGhlConnected] = useState(false);

  const [formData, setFormData] = useState({
    ghl_user_id: '',
    user_name: '',
    user_email: '',
    commission_type: 'gross',
    commission_percentage: '10',
    subscription_commission_percentage: '5',
    subscription_commission_type: 'first_payment_only',
    subscription_duration_months: '12',
    notes: ''
  });

  useEffect(() => {
    Promise.all([
      checkGHLConnection(),
      fetchCommissions()
    ]).finally(() => setLoading(false));
  }, []);

  const checkGHLConnection = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      setGhlConnected(data.connected);
      
      if (data.connected) {
        await fetchGHLUsers();
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setGhlConnected(false);
    }
  };

  const fetchGHLUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch('/api/integrations/automake/users');
      const data = await response.json();
      
      if (response.ok) {
        setGhlUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to fetch GoHighLevel users');
      }
    } catch (error) {
      setError('Failed to fetch GoHighLevel users');
      console.error('Error fetching GHL users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCommissions = async () => {
    try {
      const response = await fetch('/api/ghl/user-commissions');
      const data = await response.json();
      
      if (response.ok) {
        setCommissions(data.commissions || []);
      } else {
        setError(data.error || 'Failed to fetch user commissions');
      }
    } catch (error) {
      setError('Failed to fetch user commissions');
      console.error('Error fetching commissions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ghl/user-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          commission_percentage: parseFloat(formData.commission_percentage),
          subscription_commission_percentage: parseFloat(formData.subscription_commission_percentage),
          subscription_duration_months: parseInt(formData.subscription_duration_months)
        })
      });

      const data = await response.json();

      if (response.ok) {
        await fetchCommissions();
        resetForm();
        setSuccess('Commission settings saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save commission settings');
      }
    } catch (error) {
      setError('Failed to save commission settings');
      console.error('Error saving commission:', error);
    }
  };

  const handleDelete = async (commissionId: string) => {
    if (!confirm('Are you sure you want to remove this commission setting?')) {
      return;
    }

    try {
      const response = await fetch(`/api/ghl/user-commissions?id=${commissionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchCommissions();
        setSuccess('Commission setting removed successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove commission setting');
      }
    } catch (error) {
      setError('Failed to remove commission setting');
      console.error('Error removing commission:', error);
    }
  };

  const handleEditUser = (user: GHLUser) => {
    const existingCommission = commissions.find(c => c.ghl_user_id === user.id);
    
    setEditingUser(user);
    setFormData({
      ghl_user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      commission_type: existingCommission?.commission_type || 'gross',
      commission_percentage: existingCommission?.commission_percentage?.toString() || '10',
      subscription_commission_percentage: existingCommission?.subscription_commission_percentage?.toString() || '5',
      subscription_commission_type: existingCommission?.subscription_commission_type || 'first_payment_only',
      subscription_duration_months: existingCommission?.subscription_duration_months?.toString() || '12',
      notes: existingCommission?.notes || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      ghl_user_id: '',
      user_name: '',
      user_email: '',
      commission_type: 'gross',
      commission_percentage: '10',
      subscription_commission_percentage: '5',
      subscription_commission_type: 'first_payment_only',
      subscription_duration_months: '12',
      notes: ''
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const getUnassignedUsers = () => {
    const assignedUserIds = commissions.map(c => c.ghl_user_id);
    return ghlUsers.filter(user => !assignedUserIds.includes(user.id) && user.isActive !== false);
  };

  const getUserCommission = (userId: string) => {
    return commissions.find(c => c.ghl_user_id === userId);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!ghlConnected) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel Required</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You need to connect your GoHighLevel account to manage user commission settings.
          </p>
          <a
            href="/ghl"
            className="inline-flex items-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <span>Connect GoHighLevel</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link 
          href="/ghl/settings"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to GHL Settings</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Commission Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure default commission rates for your GoHighLevel team members. These rates apply to both one-time sales and subscriptions.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total GHL Users</p>
              <p className="text-2xl font-bold text-gray-900">{ghlUsers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Configured</p>
              <p className="text-2xl font-bold text-gray-900">{commissions.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Not Configured</p>
              <p className="text-2xl font-bold text-gray-900">{getUnassignedUsers().length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Commission Configurations</h2>
        <button
          onClick={fetchGHLUsers}
          disabled={usersLoading}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-400"
        >
          <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingUser ? `Configure Commission for ${editingUser.name}` : 'Configure User Commission'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* One-Time Sales Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">One-Time Sales Commission</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Type
                  </label>
                  <select
                    value={formData.commission_type}
                    onChange={(e) => setFormData({ ...formData, commission_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {COMMISSION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {COMMISSION_TYPES.find(t => t.value === formData.commission_type)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default commission percentage for one-time sales
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription/Recurring Section */}
            <div className="pb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Subscription/Recurring Commission</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Commission Type
                  </label>
                  <select
                    value={formData.subscription_commission_type}
                    onChange={(e) => setFormData({ ...formData, subscription_commission_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {SUBSCRIPTION_COMMISSION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {SUBSCRIPTION_COMMISSION_TYPES.find(t => t.value === formData.subscription_commission_type)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.subscription_commission_percentage}
                    onChange={(e) => setFormData({ ...formData, subscription_commission_percentage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Commission percentage for subscription payments
                  </p>
                </div>

                {formData.subscription_commission_type === 'duration_based' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.subscription_duration_months}
                      onChange={(e) => setFormData({ ...formData, subscription_duration_months: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Number of months to pay commission
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this commission structure..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Commission Settings</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {ghlUsers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
            <p className="text-gray-600 mb-4">
              Click "Refresh Users" to load your GoHighLevel team members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ghlUsers.filter(user => user.isActive !== false).map((user) => {
              const commission = getUserCommission(user.id);
              const isConfigured = !!commission;
              
              return (
                <div
                  key={user.id}
                  className={`bg-white border rounded-lg p-6 ${
                    isConfigured ? 'border-green-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                        {isConfigured && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Configured
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{user.email}</p>
                      
                      {commission && (
                        <div className="space-y-2 border-t border-gray-100 pt-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">One-Time Sales:</span>
                            <span className="font-medium text-gray-900">
                              {commission.commission_percentage}% ({commission.commission_type})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Subscriptions:</span>
                            <span className="font-medium text-gray-900">
                              {commission.subscription_commission_percentage}% ({commission.subscription_commission_type})
                            </span>
                          </div>
                          {commission.notes && (
                            <p className="text-xs text-gray-500 italic pt-1">{commission.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 flex items-center space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className={`inline-flex items-center space-x-1 px-3 py-1 text-sm rounded-lg transition-colors ${
                          isConfigured
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isConfigured ? (
                          <>
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Configure</span>
                          </>
                        )}
                      </button>
                      {commission && (
                        <button
                          onClick={() => handleDelete(commission.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Commission Settings</h3>
            <p className="text-blue-700 text-sm mt-1">
              These default commission rates are used when calculating commissions for sales transactions. 
              You can override these rates on individual opportunities if needed. Subscription commissions 
              support different calculation methods including first payment only, all payments, or duration-based.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}