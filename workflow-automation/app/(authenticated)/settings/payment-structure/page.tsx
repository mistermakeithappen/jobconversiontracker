'use client';

import { useState, useEffect } from 'react';
import { Plus, DollarSign, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, User, RefreshCw, Users, Building2, ArrowLeft } from 'lucide-react';
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
    effective_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    Promise.all([
      checkGHLConnection(),
      fetchAssignments()
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
      effective_date: assignment.effective_date
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
      effective_date: new Date().toISOString().split('T')[0]
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
      effective_date: new Date().toISOString().split('T')[0]
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
                <div key={user.id} className="bg-white border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{user.name}</h4>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Assigned
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      {assignment && (
                        <p className="text-sm font-medium text-green-700 mt-1">
                          {getPaymentDescription(assignment)}
                        </p>
                      )}
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
                        onClick={() => assignment && handleEdit(assignment)}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
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

      {/* Assign/Edit Form */}
      {showAssignForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
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

            <div className="flex space-x-3">
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingAssignment ? 'Update' : 'Assign'} Payment Structure</span>
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

      {/* Current Assignments */}
      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Assignments</h3>
            <p className="text-gray-600 mb-4">
              Start by assigning payment structures to your GoHighLevel team members above.
            </p>
          </div>
        ) : (
          assignments.map((assignment) => (
            <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-medium text-gray-900">{assignment.ghl_user_name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(assignment.payment_type)}`}>
                        {PAYMENT_TYPES.find(t => t.value === assignment.payment_type)?.label || assignment.payment_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{assignment.ghl_user_email}</p>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {getPaymentDescription(assignment)}
                    </p>
                    {assignment.notes && (
                      <p className="text-sm text-gray-600 mt-1">{assignment.notes}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span>Effective {new Date(assignment.effective_date).toLocaleDateString()}</span>
                      <span>Added {new Date(assignment.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(assignment)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(assignment.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Payment Structures</h3>
            <p className="text-blue-700 text-sm mt-1">
              Payment structures are pulled from your GoHighLevel team and will be used in future updates for automatic payroll calculations, 
              commission tracking, and financial reporting. Each user can have one active payment structure at a time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}