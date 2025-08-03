'use client';

import { useState, useEffect } from 'react';
import { Receipt as ReceiptIcon, MessageSquare, Camera, Smartphone, RefreshCw, CheckCircle, Plus, TrendingUp, Eye, Calendar, DollarSign, Building, Check } from 'lucide-react';
import Link from 'next/link';

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
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalReimbursable: 0,
    totalNonReimbursable: 0,
    recentSMSCount: 0
  });
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'reimbursed' | 'company'>('pending');

  useEffect(() => {
    checkConnectionStatus();
    syncOpportunitiesAndFetchReceipts();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      // Connection status is already set above
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const fetchReceiptStats = async () => {
    try {
      const response = await fetch('/api/receipts');
      const data = await response.json();
      
      if (response.ok && data.receipts) {
        const totalReceipts = data.receipts.length;
        const reimbursable = data.receipts.filter((r: Receipt) => r.is_reimbursable).length;
        const nonReimbursable = totalReceipts - reimbursable;
        
        setStats({
          totalReceipts,
          totalReimbursable: reimbursable,
          totalNonReimbursable: nonReimbursable,
          recentSMSCount: 0 // TODO: implement SMS tracking
        });
      }
    } catch (error) {
      console.error('Error fetching receipt stats:', error);
    }
  };

  const syncOpportunitiesAndFetchReceipts = async () => {
    try {
      setReceiptsLoading(true);
      
      // First sync opportunities to populate the cache
      await fetch('/api/integrations/automake/opportunities');
      
      // Then fetch receipts and stats
      await Promise.all([
        fetchReceipts(),
        fetchReceiptStats()
      ]);
    } catch (error) {
      console.error('Error syncing opportunities and fetching receipts:', error);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await fetch('/api/receipts');
      const data = await response.json();
      
      if (response.ok) {
        setReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  const markAsReimbursed = async (receiptId: string) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}/reimburse`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Refresh receipts to update the UI
        await fetchReceipts();
      } else {
        alert('Failed to mark receipt as reimbursed');
      }
    } catch (error) {
      console.error('Error marking receipt as reimbursed:', error);
      alert('Error marking receipt as reimbursed');
    }
  };

  // Filter receipts based on active tab
  const filteredReceipts = receipts.filter(receipt => {
    if (activeTab === 'pending') {
      return receipt.is_reimbursable && (!receipt.reimbursement_status || receipt.reimbursement_status === 'pending');
    } else if (activeTab === 'reimbursed') {
      return receipt.is_reimbursable && receipt.reimbursement_status === 'paid';
    } else {
      // Company card expenses
      return !receipt.is_reimbursable;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/automake/connect');
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

  const features = [
    {
      title: 'SMS Receipt Processing',
      description: 'Send receipt photos via SMS for automatic processing',
      icon: Smartphone,
      status: 'Active',
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'AI Data Extraction',
      description: 'Automatically extract vendor, amount, date, and category',
      icon: Camera,
      status: 'Active',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Smart Job Matching',
      description: 'AI matches receipts to opportunities automatically',
      icon: TrendingUp,
      status: 'Active',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Automated Conversations',
      description: 'Two-way SMS conversations for confirmation',
      icon: MessageSquare,
      status: 'Active',
      color: 'bg-orange-100 text-orange-600'
    }
  ];

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
        <ReceiptIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel for receipt processing</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Link your GHL account to enable AI-powered receipt processing via SMS
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Receipt Processing</h2>
          <p className="text-gray-600">AI-powered receipt processing with SMS automation</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </span>
          <Link
            href="/test-receipt-ai"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>Test AI Processing</span>
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ReceiptIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Receipts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReceipts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reimbursable</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReimbursable}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ReceiptIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Non-Reimbursable</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalNonReimbursable}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">SMS Messages</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentSMSCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">How AI Receipt Processing Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">1. Send via SMS</h4>
            <p className="text-sm text-gray-600">
              Field workers text receipt photos to the system via SMS or WhatsApp
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">2. AI Extraction</h4>
            <p className="text-sm text-gray-600">
              GPT-4 Vision extracts vendor, amount, date, description, and category
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">3. Smart Matching</h4>
            <p className="text-sm text-gray-600">
              AI matches receipts to active opportunities using intelligent algorithms
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-orange-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">4. Confirmation</h4>
            <p className="text-sm text-gray-600">
              Two-way SMS conversation confirms job match and auto-logs receipt
            </p>
          </div>
        </div>
      </div>



      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-semibold text-gray-900">Receipts</h3>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending Reimbursement
              </button>
              <button
                onClick={() => setActiveTab('reimbursed')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'reimbursed'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Reimbursed
              </button>
              <button
                onClick={() => setActiveTab('company')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'company'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Company Card
              </button>
            </div>
          </div>
          <button
            onClick={syncOpportunitiesAndFetchReceipts}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {receiptsLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading receipts...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12">
            <ReceiptIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'pending' ? 'No Pending Receipts' : 
               activeTab === 'reimbursed' ? 'No Reimbursed Receipts' : 
               'No Company Card Receipts'}
            </h3>
            <p className="text-gray-600 mb-4">
              {activeTab === 'pending' 
                ? 'All reimbursable receipts have been processed!'
                : activeTab === 'reimbursed'
                ? 'No receipts have been marked as reimbursed yet.'
                : 'No company card expenses recorded yet.'}
            </p>
            <Link
              href="/test-receipt-ai"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Test AI Processing</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Opportunity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt: Receipt) => (
                  <tr key={receipt.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(receipt.receipt_date || receipt.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {receipt.vendor_name || 'Unknown Vendor'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(receipt.amount)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {receipt.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {receipt.opportunity_name ? (
                        <span className="text-sm text-gray-900">{receipt.opportunity_name}</span>
                      ) : (
                        <span className="text-sm text-gray-500">Not assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        receipt.is_reimbursable
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {receipt.is_reimbursable ? 'Reimbursable' : 'Non-Reimbursable'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/ghl/opportunities?highlight=${receipt.opportunity_id}`}
                          className="inline-flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </Link>
                        {activeTab === 'pending' && receipt.is_reimbursable && (
                          <button
                            onClick={() => markAsReimbursed(receipt.id)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-all hover:shadow-md active:scale-95"
                            title="Mark as reimbursed"
                          >
                            <Check className="w-4 h-4" />
                            <span>Mark as Paid</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Setup Instructions</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div className="flex items-start space-x-2">
            <span className="font-medium">1.</span>
            <span>Add your OpenAI API key in <Link href="/integrations" className="underline">Integrations</Link></span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium">2.</span>
            <span>Configure company credit cards in <Link href="/ghl/settings" className="underline">Settings</Link></span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium">3.</span>
            <span>Sync your GoHighLevel contacts and opportunities</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium">4.</span>
            <span>Test the system using the AI Receipt Test page</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-medium">5.</span>
            <span>Set up SMS/WhatsApp webhooks for production use</span>
          </div>
        </div>
      </div>
    </div>
  );
}