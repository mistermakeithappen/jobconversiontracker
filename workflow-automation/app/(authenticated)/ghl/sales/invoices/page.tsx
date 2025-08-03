'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { FileText, RefreshCw, Search, Filter, DollarSign, Calendar, User, AlertCircle, CheckCircle, Clock, XCircle, Download } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  opportunity_id?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  currency: string;
  due_date?: string;
  sent_date?: string;
  notes?: string;
  event_type: string;
}

interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  byStatus: {
    draft: number;
    sent: number;
    viewed: number;
    paid: number;
    partially_paid: number;
    overdue: number;
    void: number;
  };
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  void: 'bg-gray-100 text-gray-600'
};

const statusIcons = {
  draft: Clock,
  sent: AlertCircle,
  paid: CheckCircle,
  overdue: XCircle,
  void: XCircle
};

export default function InvoicesManagement() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchInvoices();
    }
  }, [selectedIntegration, statusFilter]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // The status endpoint returns a single integration, not an array
        if (data.connected && data.integration) {
          setIntegrations([data.integration]);
          setSelectedIntegration(data.integration.id);
        } else {
          setIntegrations([]);
        }
      } else {
        console.error('Failed to fetch integrations:', response.status);
        setIntegrations([]);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setIntegrations([]);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    setSyncError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedIntegration) params.append('integrationId', selectedIntegration);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/sales/invoices?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncInvoices = async () => {
    setSyncing(true);
    setSyncError(null);
    
    try {
      const response = await fetch('/api/sales/sync-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ integrationId: selectedIntegration })
      });

      const data = await response.json();
      
      if (response.ok) {
        await fetchInvoices();
      } else {
        setSyncError(data.error || 'Failed to sync invoices');
        if (data.requiresReauth) {
          setSyncError('Please reconnect your GoHighLevel integration to enable invoice access.');
        }
      }
    } catch (error) {
      console.error('Error syncing invoices:', error);
      setSyncError('An error occurred while syncing invoices');
    } finally {
      setSyncing(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchTerm ? 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.contact_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.opportunity_id?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'sent':
      case 'viewed':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'void':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
      case 'viewed':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'void':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportInvoices = () => {
    const csv = [
      ['Invoice Number', 'Date', 'Amount', 'Status', 'Contact Name', 'Contact Email', 'Opportunity ID', 'Due Date'],
      ...filteredInvoices.map(inv => [
        inv.invoice_number,
        formatDate(inv.invoice_date),
        inv.amount,
        inv.status,
        inv.contact_name || inv.contact_id || '',
        inv.contact_email || '',
        inv.opportunity_id || '',
        inv.due_date ? formatDate(inv.due_date) : ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!selectedIntegration && integrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No GoHighLevel integration found</p>
          <a href="/ghl/settings" className="text-indigo-600 hover:text-indigo-500">
            Connect GoHighLevel →
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading invoices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportInvoices}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            onClick={syncInvoices}
            disabled={syncing || !selectedIntegration}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Invoices'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <div className="flex">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <p className="text-sm">{syncError}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-600">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-600">Total Due</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalDue)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Invoice number, contact, or opportunity"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Integration
            </label>
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {integrations.map(integration => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No invoices found</p>
            <p className="text-sm text-gray-400">
              {invoices.length === 0 
                ? 'Click "Sync Invoices" to import from GoHighLevel'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(invoice.status)}
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.invoice_number}
                          </div>
                          {(invoice.contact_name || invoice.contact_id) && (
                            <div className="text-sm text-gray-500">
                              {invoice.contact_name || invoice.contact_id}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {formatDate(invoice.invoice_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </div>
                        {invoice.amount_paid > 0 && invoice.amount_paid < invoice.amount && (
                          <div className="text-gray-500">
                            Paid: {formatCurrency(invoice.amount_paid, invoice.currency)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}