'use client';

import { useEffect, useState } from 'react';
import { X, Receipt, Clock, DollarSign, Calendar, FileText, MapPin, CreditCard, AlertCircle, Plus, Upload, Users, Save } from 'lucide-react';

interface Commission {
  id: string;
  assignment_type: 'opportunity' | 'sales_rep' | 'product' | 'custom';
  opportunity_id?: string;
  opportunity_name?: string;
  opportunity_value?: number;
  ghl_user_id: string;
  user_name: string;
  user_email?: string;
  commission_type: 'percentage_gross' | 'percentage_profit' | 'fixed_amount';
  base_rate: number;
  commission_amount: number;
  is_active: boolean;
  is_disabled: boolean;
  is_paid: boolean;
  paid_date?: string;
  paid_amount?: number;
  payment_reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Receipt {
  id: string;
  vendor_name: string;
  description?: string;
  amount: number;
  category: string;
  receipt_date: string;
  notes?: string;
  reimbursable: boolean;
  payment_method?: string;
  last_four_digits?: string;
  submitted_by: string;
}

interface TimeEntry {
  id: string;
  ghl_user_id: string;
  user_name: string;
  hours: number;
  hourly_rate?: number;
  description: string;
  work_date: string;
  total_cost?: number;
}

interface CommissionDetailModalProps {
  commission: Commission | null;
  isOpen: boolean;
  onClose: () => void;
  integrationId?: string;
  onUpdate?: () => void;
  ghlUsers?: Array<{ id: string; name: string; email: string }>;
}

export default function CommissionDetailModal({ commission, isOpen, onClose, integrationId, onUpdate, ghlUsers: propGhlUsers }: CommissionDetailModalProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && commission?.opportunity_id) {
      fetchDetails();
    } else {
      // Reset state when modal closes
      setReceipts([]);
      setTimeEntries([]);
      setError(null);
    }
  }, [isOpen, commission?.opportunity_id]);

  const fetchDetails = async () => {
    if (!commission?.opportunity_id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch receipts and time entries in parallel
      const [receiptsRes, timeEntriesRes] = await Promise.all([
        fetch(`/api/receipts?opportunityId=${commission.opportunity_id}`),
        fetch(`/api/time-entries?opportunityId=${commission.opportunity_id}`)
      ]);
      
      const receiptsData = receiptsRes.ok ? await receiptsRes.json() : { receipts: [] };
      const timeEntriesData = timeEntriesRes.ok ? await timeEntriesRes.json() : { timeEntries: [] };
      
      setReceipts(receiptsData.receipts || []);
      setTimeEntries(timeEntriesData.timeEntries || []);
      
    } catch (error) {
      console.error('Error fetching commission details:', error);
      setError('Failed to load commission details');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };



  const totalExpenses = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalLaborCost = timeEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0);
  const reimbursableExpenses = receipts.filter(r => r.reimbursable).reduce((sum, r) => sum + r.amount, 0);
  const nonReimbursableExpenses = receipts.filter(r => !r.reimbursable).reduce((sum, r) => sum + r.amount, 0);

  if (!isOpen || !commission) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="text-2xl mr-2">
                {commission.assignment_type === 'opportunity' ? '🎯' : 
                 commission.assignment_type === 'sales_rep' ? '👤' :
                 commission.assignment_type === 'product' ? '📦' : '💰'}
              </span>
              {commission.opportunity_name || 'Commission Details'}
            </h2>
            <p className="text-gray-600 mt-1">
              {commission.user_name} • {formatDate(commission.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading details...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="w-8 h-8 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600">Sale Amount</p>
                      <p className="text-xl font-bold text-blue-900">{formatCurrency(commission.opportunity_value || 0)}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600">Commission</p>
                      <p className="text-xl font-bold text-green-900">{formatCurrency(commission.commission_amount)}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600">Total Expenses</p>
                      <p className="text-xl font-bold text-orange-900">{formatCurrency(totalExpenses)}</p>
                    </div>
                    <Receipt className="w-8 h-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600">Total Hours</p>
                      <p className="text-xl font-bold text-purple-900">{totalHours.toFixed(1)}</p>
                    </div>
                    <Clock className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Expenses Breakdown */}
              {reimbursableExpenses > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600">Reimbursable</p>
                        <p className="text-lg font-bold text-red-900">{formatCurrency(reimbursableExpenses)}</p>
                      </div>
                      <CreditCard className="w-6 h-6 text-red-600" />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Non-Reimbursable</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(nonReimbursableExpenses)}</p>
                      </div>
                      <CreditCard className="w-6 h-6 text-gray-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Receipts Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Receipt className="w-5 h-5 mr-2" />
                  Receipts ({receipts.length})
                </h3>


                {receipts.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {receipts.map((receipt) => (
                            <tr key={receipt.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{receipt.vendor_name}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-900">{receipt.description || 'No description'}</div>
                                <div className="text-xs text-gray-500">{receipt.category}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{formatCurrency(receipt.amount)}</div>
                                {receipt.payment_method === 'credit_card' && receipt.last_four_digits && (
                                  <div className="text-xs text-gray-500">•••• {receipt.last_four_digits}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatDate(receipt.receipt_date)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  receipt.reimbursable 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {receipt.reimbursable ? 'Reimbursable' : 'Company Card'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{receipt.submitted_by}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* Time Entries Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Time Entries ({timeEntries.length})
                </h3>

                {timeEntries.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Person</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {timeEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{entry.user_name}</div>
                                <div className="text-xs text-gray-500">{entry.ghl_user_id}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.description}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.hours} hrs</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entry.hourly_rate ? formatCurrency(entry.hourly_rate) : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {entry.total_cost ? formatCurrency(entry.total_cost) : 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatDate(entry.work_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                  
                {totalLaborCost > 0 && (
                  <div className="mt-4 mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600">Total Labor Cost</p>
                        <p className="text-lg font-bold text-purple-900">{formatCurrency(totalLaborCost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-purple-600">Total Hours</p>
                        <p className="text-lg font-bold text-purple-900">{totalHours} hrs</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Commissions Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Commission Details
                </h3>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Commission Type</p>
                      <p className="font-medium text-gray-900">
                        {commission.commission_type === 'percentage_profit' ? 'Percentage of Profit' : 
                         commission.commission_type === 'percentage_gross' ? 'Percentage of Gross' : 
                         'Fixed Amount'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Base Rate</p>
                      <p className="font-medium text-gray-900">
                        {commission.commission_type === 'fixed_amount' 
                          ? formatCurrency(commission.base_rate)
                          : `${commission.base_rate}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Commission Amount</p>
                      <p className="font-medium text-gray-900 text-lg">{formatCurrency(commission.commission_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="font-medium">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          commission.is_paid 
                            ? 'bg-green-100 text-green-800' 
                            : commission.is_disabled 
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {commission.is_paid ? 'Paid' : commission.is_disabled ? 'Disabled' : 'Active'}
                        </span>
                      </p>
                    </div>
                  </div>
                  {commission.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="text-gray-900">{commission.notes}</p>
                    </div>
                  )}
                  
                  {/* Info message about editing */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          To edit commission details or add receipts/time entries, 
                          <button
                            onClick={() => {
                              onClose();
                              // Navigate to opportunities page
                              window.location.href = `/ghl/opportunities?openOpportunity=${commission.opportunity_id}`;
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800 underline font-medium"
                          >
                            open this opportunity
                          </button>
                          {' '}in the Opportunities tab.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}