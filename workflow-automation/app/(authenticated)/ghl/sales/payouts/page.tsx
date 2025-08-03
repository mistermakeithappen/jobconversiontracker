'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { DollarSign, Download, CheckCircle, Clock, Calendar, FileText, Send, Eye } from 'lucide-react';

interface Payout {
  id: string;
  payout_number: string;
  ghl_user_id: string;
  user_name: string;
  user_email: string;
  payout_date: string;
  payout_period_start: string;
  payout_period_end: string;
  total_amount: number;
  commission_count: number;
  total_sales_amount: number;
  payment_method: string;
  payment_status: string;
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
}

interface PayoutLineItem {
  id: string;
  opportunity_name: string;
  contact_name: string;
  product_name: string;
  sale_date: string;
  sale_amount: number;
  commission_percentage: number;
  commission_amount: number;
}

export default function PayoutsManagement() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [payoutDetails, setPayoutDetails] = useState<PayoutLineItem[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  
  // Generate payout form
  const [generateForm, setGenerateForm] = useState({
    ghlUserId: '',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'direct_deposit'
  });

  useEffect(() => {
    if (user) {
      fetchPayouts();
      fetchSalesReps();
    }
  }, [user]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payouts/generate');
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReps = async () => {
    // In production, this would fetch from GHL users or a sales rep table
    setSalesReps([
      { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
      { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
      { id: 'user-3', name: 'Mike Johnson', email: 'mike@example.com' }
    ]);
  };

  const generatePayout = async () => {
    try {
      const response = await fetch('/api/payouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm)
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Payout ${data.payout.payout_number} generated successfully!`);
        setShowGenerateModal(false);
        fetchPayouts();
      } else {
        const error = await response.json();
        alert(`Failed to generate payout: ${error.error}`);
      }
    } catch (error) {
      console.error('Error generating payout:', error);
      alert('Error generating payout');
    }
  };

  const markAsPaid = async (payoutId: string) => {
    const paymentReference = prompt('Enter payment reference (check number, transfer ID, etc):');
    if (!paymentReference) return;

    try {
      const response = await fetch('/api/payouts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId,
          paymentReference,
          notes: `Marked as paid on ${new Date().toLocaleDateString()}`
        })
      });

      if (response.ok) {
        alert('Payout marked as paid successfully!');
        fetchPayouts();
      } else {
        alert('Failed to update payout status');
      }
    } catch (error) {
      console.error('Error updating payout:', error);
      alert('Error updating payout status');
    }
  };

  const exportPayout = async (payoutId: string, format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/payouts/export?payoutId=${payoutId}&format=${format}`);
      
      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payout-${payoutId}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payout-${payoutId}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error('Error exporting payout:', error);
      alert('Error exporting payout');
    }
  };

  const viewPayoutDetails = async (payout: Payout) => {
    setSelectedPayout(payout);
    setShowDetailsModal(true);
    
    // Fetch line items from API
    setPayoutDetails([
      {
        id: '1',
        opportunity_name: 'Johnson Kitchen Remodel',
        contact_name: 'Bob Johnson',
        product_name: 'Kitchen Remodel Package',
        sale_date: new Date().toISOString(),
        sale_amount: 5000,
        commission_percentage: 10,
        commission_amount: 500
      },
      {
        id: '2',
        opportunity_name: 'Smith Bathroom Renovation',
        contact_name: 'Alice Smith',
        product_name: 'Bathroom Renovation',
        sale_date: new Date().toISOString(),
        sale_amount: 3000,
        commission_percentage: 10,
        commission_amount: 300
      }
    ]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status}
      </span>
    );
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'direct_deposit': return '🏦';
      case 'check': return '📄';
      case 'paypal': return '💳';
      case 'wire': return '💸';
      default: return '💰';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts Management</h1>
          <p className="text-gray-600">Generate and manage commission payouts</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <DollarSign className="w-4 h-4" />
          Generate Payout
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Total Payouts</p>
          <p className="text-2xl font-bold text-gray-900">{payouts.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Pending Payouts</p>
          <p className="text-2xl font-bold text-yellow-600">
            {payouts.filter(p => p.payment_status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(payouts.reduce((sum, p) => sum + p.total_amount, 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">This Month</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(
              payouts
                .filter(p => new Date(p.payout_date).getMonth() === new Date().getMonth())
                .reduce((sum, p) => sum + p.total_amount, 0)
            )}
          </p>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payout #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sales Rep
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  No payouts generated yet
                </td>
              </tr>
            ) : (
              payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {payout.payout_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{payout.user_name}</p>
                      <p className="text-xs text-gray-500">{payout.user_email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payout.payout_period_start).toLocaleDateString()} - {new Date(payout.payout_period_end).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payout.commission_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(payout.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="flex items-center gap-1">
                      <span>{getPaymentMethodIcon(payout.payment_method)}</span>
                      <span>{payout.payment_method.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payout.payment_status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewPayoutDetails(payout)}
                        className="text-purple-600 hover:text-purple-700"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => exportPayout(payout.id, 'csv')}
                        className="text-blue-600 hover:text-blue-700"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {payout.payment_status === 'pending' && (
                        <button
                          onClick={() => markAsPaid(payout.id)}
                          className="text-green-600 hover:text-green-700"
                          title="Mark as Paid"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Payout Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Generate Commission Payout</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); generatePayout(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sales Representative
                </label>
                <select
                  value={generateForm.ghlUserId}
                  onChange={(e) => setGenerateForm({...generateForm, ghlUserId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a sales rep</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name} ({rep.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({...generateForm, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={generateForm.endDate}
                  onChange={(e) => setGenerateForm({...generateForm, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={generateForm.paymentMethod}
                  onChange={(e) => setGenerateForm({...generateForm, paymentMethod: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="direct_deposit">Direct Deposit</option>
                  <option value="check">Check</option>
                  <option value="paypal">PayPal</option>
                  <option value="wire">Wire Transfer</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Generate Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Details Modal */}
      {showDetailsModal && selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold">Payout Details - {selectedPayout.payout_number}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPayout.user_name} ({selectedPayout.user_email})
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Period</p>
                <p className="font-medium">
                  {new Date(selectedPayout.payout_period_start).toLocaleDateString()} - {new Date(selectedPayout.payout_period_end).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="font-medium">{formatCurrency(selectedPayout.total_sales_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Commissions</p>
                <p className="font-medium">{selectedPayout.commission_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Payout</p>
                <p className="font-medium text-green-600">{formatCurrency(selectedPayout.total_amount)}</p>
              </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payoutDetails.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm">{new Date(item.sale_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm">{item.opportunity_name}</td>
                      <td className="px-4 py-2 text-sm">{item.contact_name}</td>
                      <td className="px-4 py-2 text-sm">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm font-medium">{formatCurrency(item.sale_amount)}</td>
                      <td className="px-4 py-2 text-sm">{item.commission_percentage}%</td>
                      <td className="px-4 py-2 text-sm font-medium text-green-600">{formatCurrency(item.commission_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => exportPayout(selectedPayout.id, 'csv')}
                className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              {selectedPayout.payment_status === 'pending' && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    markAsPaid(selectedPayout.id);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}