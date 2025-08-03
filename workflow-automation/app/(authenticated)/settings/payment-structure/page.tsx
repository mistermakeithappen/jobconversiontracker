'use client';

import { useState, useEffect } from 'react';
import { Plus, DollarSign, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, User, RefreshCw, Users, Building2, ArrowLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';

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

interface PaymentAssignment {
  id: string;
  user_id: string; // GHL user ID
  ghl_user_name: string;
  ghl_user_email: string;
  ghl_user_phone?: string;
  payment_type: string;
  hourly_rate?: number;
  annual_salary?: number;
  commission_percentage?: number;
  base_salary?: number;
  overtime_rate?: number;
  notes?: string;
  effective_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  // Commission settings
  commission_type?: string;
  subscription_commission_percentage?: number;
  subscription_commission_type?: string;
  subscription_duration_months?: number;
}

const PAYMENT_TYPES = [
  { value: 'hourly', label: 'Hourly', description: 'Paid by the hour' },
  { value: 'salary', label: 'Salary', description: 'Fixed annual salary' },
  { value: 'commission_gross', label: 'Commission (% of Gross)', description: 'Percentage of gross revenue' },
  { value: 'commission_profit', label: 'Commission (% of Profit)', description: 'Percentage of net profit' },
  { value: 'hybrid', label: 'Hybrid', description: 'Base salary + commission' },
  { value: 'contractor', label: 'Contractor', description: '1099 contractor' }
];

export default function PaymentStructurePage() {
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  const [assignments, setAssignments] = useState<PaymentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<GHLUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ghlConnected, setGhlConnected] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    ghl_user_id: '',
    ghl_user_name: '',
    ghl_user_email: '',
    ghl_user_phone: '',
    payment_type: 'hourly',
    hourly_rate: '',
    annual_salary: '',
    commission_percentage: '',
    base_salary: '',
    overtime_rate: '',
    notes: '',
    effective_date: new Date().toISOString().split('T')[0],
    // Commission settings
    commission_type: 'gross',
    subscription_commission_percentage: '',
    subscription_commission_type: 'first_payment_only',
    subscription_duration_months: '12'
  });

  useEffect(() => {
    Promise.all([
      checkGHLConnection(),
      fetchAssignments(),
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

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/user-payment-assignments');
      const data = await response.json();
      
      if (response.ok) {
        setAssignments(data.assignments || []);
      } else {
        setError(data.error || 'Failed to fetch payment assignments');
      }
    } catch (error) {
      setError('Failed to fetch payment assignments');
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchCommissions = async () => {
    try {
      const response = await fetch('/api/ghl/user-commissions');
      const data = await response.json();
      
      if (response.ok) {
        setCommissions(data.commissions || []);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
    }
  };

  const saveCommissionSettings = async (userId: string, userName: string, userEmail: string) => {
    try {
      const response = await fetch('/api/ghl/user-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ghl_user_id: userId,
          user_name: userName,
          user_email: userEmail,
          commission_type: formData.commission_type,
          commission_percentage: parseFloat(formData.commission_percentage || '10'),
          subscription_commission_percentage: parseFloat(formData.subscription_commission_percentage || '5'),
          subscription_commission_type: formData.subscription_commission_type,
          subscription_duration_months: parseInt(formData.subscription_duration_months || '12')
        })
      });

      if (response.ok) {
        await fetchCommissions();
      }
    } catch (error) {
      console.error('Error saving commission settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const url = '/api/user-payment-assignments';
      const method = editingAssignment ? 'PUT' : 'POST';
      
      const body = editingAssignment 
        ? { id: editingAssignment, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        // Also save commission settings
        await saveCommissionSettings(formData.ghl_user_id, formData.ghl_user_name, formData.ghl_user_email);
        await fetchAssignments();
        resetForm();
        setSuccess(`Payment structure ${editingAssignment ? 'updated' : 'assigned'} successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('Full API Response:', response);
        console.error('Response Status:', response.status);
        console.error('Response Headers:', response.headers);
        console.error('Response Data:', data);
        console.error('Request Body:', JSON.stringify(body));
        
        const errorMessage = data.details ? `${data.error}: ${data.details}` : data.error || `Failed to save payment assignment (Status: ${response.status})`;
        setError(errorMessage);
      }
    } catch (error) {
      setError('Failed to save payment assignment');
      console.error('Error saving assignment:', error);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this payment assignment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user-payment-assignments?id=${assignmentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchAssignments();
        setSuccess('Payment assignment removed successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove payment assignment');
      }
    } catch (error) {
      setError('Failed to remove payment assignment');
      console.error('Error removing assignment:', error);
    }
  };

  const handleEdit = (assignment: PaymentAssignment) => {
    const commission = getUserCommission(assignment.user_id);
    setFormData({
      ghl_user_id: assignment.user_id,
      ghl_user_name: assignment.ghl_user_name,
      ghl_user_email: assignment.ghl_user_email,
      ghl_user_phone: assignment.ghl_user_phone || '',
      payment_type: assignment.payment_type,
      hourly_rate: assignment.hourly_rate?.toString() || '',
      annual_salary: assignment.annual_salary?.toString() || '',
      commission_percentage: assignment.commission_percentage?.toString() || '',
      base_salary: assignment.base_salary?.toString() || '',
      overtime_rate: assignment.overtime_rate?.toString() || '',
      notes: assignment.notes || '',
      effective_date: assignment.effective_date,
      // Load commission settings from fetched data
      commission_type: commission?.commission_type || 'gross',
      subscription_commission_percentage: commission?.subscription_commission_percentage?.toString() || '5',
      subscription_commission_type: commission?.subscription_commission_type || 'first_payment_only',
      subscription_duration_months: commission?.subscription_duration_months?.toString() || '12'
    });
    setEditingAssignment(assignment.id);
    setShowAssignForm(true);
  };

  const handleAssignToUser = (user: GHLUser) => {
    setSelectedUser(user);
    setFormData({
      ghl_user_id: user.id,
      ghl_user_name: user.name,
      ghl_user_email: user.email,
      ghl_user_phone: user.phone || '',
      payment_type: 'hourly',
      hourly_rate: '',
      annual_salary: '',
      commission_percentage: '',
      base_salary: '',
      overtime_rate: '',
      notes: '',
      effective_date: new Date().toISOString().split('T')[0],
      commission_type: 'gross',
      subscription_commission_percentage: '5',
      subscription_commission_type: 'first_payment_only',
      subscription_duration_months: '12'
    });
    setEditingAssignment(null);
    setShowAssignForm(true);
  };

  const resetForm = () => {
    setFormData({
      ghl_user_id: '',
      ghl_user_name: '',
      ghl_user_email: '',
      ghl_user_phone: '',
      payment_type: 'hourly',
      hourly_rate: '',
      annual_salary: '',
      commission_percentage: '',
      base_salary: '',
      overtime_rate: '',
      notes: '',
      effective_date: new Date().toISOString().split('T')[0],
      commission_type: 'gross',
      subscription_commission_percentage: '5',
      subscription_commission_type: 'first_payment_only',
      subscription_duration_months: '12'
    });
    setEditingAssignment(null);
    setSelectedUser(null);
    setShowAssignForm(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hourly': return 'bg-blue-100 text-blue-800';
      case 'salary': return 'bg-green-100 text-green-800';
      case 'commission_gross': return 'bg-yellow-100 text-yellow-800';
      case 'commission_profit': return 'bg-purple-100 text-purple-800';
      case 'hybrid': return 'bg-indigo-100 text-indigo-800';
      case 'contractor': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getPaymentDescription = (assignment: PaymentAssignment) => {
    switch (assignment.payment_type) {
      case 'hourly':
        return `${formatCurrency(assignment.hourly_rate || 0)}/hour${assignment.overtime_rate ? ` (OT: ${formatCurrency(assignment.overtime_rate)}/hour)` : ''}`;
      case 'salary':
        return formatCurrency(assignment.annual_salary || 0) + '/year';
      case 'commission_gross':
        return `${assignment.commission_percentage || 0}% of gross revenue`;
      case 'commission_profit':
        return `${assignment.commission_percentage || 0}% of net profit`;
      case 'hybrid':
        return `${formatCurrency(assignment.base_salary || 0)}/year + ${assignment.commission_percentage || 0}% commission`;
      case 'contractor':
        return 'Contractor rate (varies)';
      default:
        return 'Not specified';
    }
  };

  const getUnassignedUsers = () => {
    const assignedUserIds = assignments.map(a => a.user_id);
    return ghlUsers.filter(user => !assignedUserIds.includes(user.id) && user.isActive !== false);
  };

  const getAssignedUsers = () => {
    const assignedUserIds = assignments.map(a => a.user_id);
    return ghlUsers.filter(user => assignedUserIds.includes(user.id) && user.isActive !== false);
  };

  const getUserAssignment = (userId: string) => {
    return assignments.find(a => a.user_id === userId);
  };

  const getUserCommission = (userId: string) => {
    return commissions.find(c => c.ghl_user_id === userId);
  };

  const COMMISSION_TYPES = [
    { value: 'gross', label: 'Gross Revenue', description: '% of total revenue' },
    { value: 'profit', label: 'Net Profit', description: '% of profit after expenses' },
    { value: 'tiered', label: 'Tiered', description: 'Different rates at revenue levels' },
    { value: 'flat', label: 'Flat Rate', description: 'Fixed amount per sale' }
  ];

  const SUBSCRIPTION_COMMISSION_TYPES = [
    { value: 'first_payment_only', label: 'First Payment Only' },
    { value: 'all_payments', label: 'All Payments' },
    { value: 'duration_based', label: 'Duration Based' }
  ];

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
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel Required</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You need to connect your GoHighLevel account to manage employee payment structures. 
            This allows us to pull your team members and assign payment information to each person.
          </p>
          <a
            href="/ghl"
            className="inline-flex items-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Building2 className="w-5 h-5" />
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
        <h1 className="text-3xl font-bold text-gray-900">Employee Payment Structures</h1>
        <p className="text-gray-600 mt-2">
          Manage payment structures for your GoHighLevel team members. Set hourly rates, salaries, commissions, and more for future payroll calculations.
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
              <p className="text-sm text-gray-500">Assigned</p>
              <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">{getUnassignedUsers().length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Payment Assignments</h2>
        <div className="flex space-x-3">
          <button
            onClick={fetchGHLUsers}
            disabled={usersLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-400"
          >
            <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Users</span>
          </button>
        </div>
      </div>

      {/* Assigned Users Section */}
      {getAssignedUsers().length > 0 && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Assigned Users ({getAssignedUsers().length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getAssignedUsers().map((user) => {
              const assignment = getUserAssignment(user.id);
              return (
                <div key={user.id} className="bg-white border border-green-200 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">{user.name}</h4>
                      
                      <p className="text-sm text-gray-600 mb-3">{user.email}</p>
                      
                      {assignment && (
                        <div className="space-y-2">
                          <div className="bg-gray-50 rounded-md px-3 py-2">
                            <p className="text-sm font-medium text-gray-900">
                              {getPaymentDescription(assignment)}
                            </p>
                          </div>
                          
                          {getUserCommission(user.id) && (
                            <div className="text-xs text-gray-600 space-y-1">
                              <p className="flex items-center">
                                <span className="font-medium mr-1">One-time:</span>
                                {getUserCommission(user.id)?.commission_percentage || assignment.commission_percentage || 10}% commission
                              </p>
                              <p className="flex items-center">
                                <span className="font-medium mr-1">Recurring:</span>
                                {getUserCommission(user.id)?.subscription_commission_percentage || 5}% commission
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role || 'user'}
                        </span>
                        {user.phone && (
                          <span className="inline-flex items-center text-xs text-gray-500">
                            <Phone className="w-3 h-3 mr-1" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-2">
                      <button
                        onClick={() => assignment && handleEdit(assignment)}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Assigned
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unassigned Users Section */}
      {getUnassignedUsers().length > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">
            Unassigned Users ({getUnassignedUsers().length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUnassignedUsers().map((user) => (
              <div key={user.id} className="bg-white border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{user.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{user.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role || 'User'}
                      </span>
                      {user.phone && (
                        <span className="text-xs text-gray-500">📞</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleAssignToUser(user)}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Assign</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showAssignForm && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={resetForm}
            />

            {/* Modal panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl max-h-[90vh] flex flex-col">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingAssignment ? 'Edit Payment Structure' : 'Assign Payment Structure'}
                    {selectedUser && (
                      <span className="text-sm font-normal text-gray-600 ml-2">
                        for {selectedUser.name}
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type *
                </label>
                <select
                  required
                  value={formData.payment_type}
                  onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  {PAYMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic fields based on payment type */}
              {formData.payment_type === 'hourly' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Rate *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      placeholder="25.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overtime Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.overtime_rate}
                      onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                      placeholder="37.50"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </>
              )}

              {formData.payment_type === 'salary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Salary *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.annual_salary}
                    onChange={(e) => setFormData({ ...formData, annual_salary: e.target.value })}
                    placeholder="75000.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              )}

              {(formData.payment_type === 'commission_gross' || formData.payment_type === 'commission_profit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Percentage *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                    placeholder="10.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              )}

              {formData.payment_type === 'hybrid' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Salary *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                      placeholder="50000.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commission Percentage *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={formData.commission_percentage}
                      onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                      placeholder="5.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </>
              )}

              {/* Commission Settings Section */}
              <div className="col-span-2 border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Commission Settings</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Commission Type
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
                  Subscription Commission (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.subscription_commission_percentage}
                  onChange={(e) => setFormData({ ...formData, subscription_commission_percentage: e.target.value })}
                  placeholder="5.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Commission rate for recurring/subscription sales
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Type
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
              </div>

              {formData.subscription_commission_type === 'duration_based' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Duration (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.subscription_duration_months}
                    onChange={(e) => setFormData({ ...formData, subscription_duration_months: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this payment structure..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingAssignment ? 'Update' : 'Assign'} Payment Structure</span>
              </button>
            </div>
          </form>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Payment & Commission Structures</h3>
            <p className="text-blue-700 text-sm mt-1">
              Payment structures and commission settings are configured together for each employee. Base pay (hourly/salary) determines regular compensation, 
              while commission settings control how sales commissions are calculated. Subscription commissions can be configured separately from one-time sale commissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}