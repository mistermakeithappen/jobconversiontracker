'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Calculator, RefreshCw, Search, User, Calendar, Clock, Send, CheckCircle, XCircle, AlertTriangle, Eye, Plus } from 'lucide-react';
import EstimateBuilder from '@/components/ghl/sales/EstimateBuilder';

interface Estimate {
  id: string;
  estimate_id: string;
  estimate_number: string;
  estimate_date: string;
  opportunity_id?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  amount: number;
  status: string;
  currency: string;
  valid_until?: string;
  sent_date?: string;
  notes?: string;
  event_type: string;
}

interface EstimateStats {
  totalEstimates: number;
  totalAmount: number;
  totalAccepted: number;
  totalPending: number;
  byStatus: {
    draft: number;
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
  };
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800'
};

const statusIcons = {
  draft: Clock,
  sent: Send,
  accepted: CheckCircle,
  declined: XCircle,
  expired: AlertTriangle
};

export default function EstimatesManagement() {
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [stats, setStats] = useState<EstimateStats | null>(null);
  const [showEstimateBuilder, setShowEstimateBuilder] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchEstimates();
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

  const fetchEstimates = async () => {
    setLoading(true);
    setSyncError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedIntegration) params.append('integrationId', selectedIntegration);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/sales/estimates?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setEstimates(data.estimates || []);
        setStats(data.stats || null);
        setTotalCount(data.stats?.totalEstimates || 0);
      }
    } catch (error) {
      console.error('Error fetching estimates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEstimates();
  };

  const syncEstimates = async () => {
    setSyncing(true);
    setSyncError(null);
    
    try {
      const response = await fetch('/api/sales/sync-estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ integrationId: selectedIntegration })
      });

      const data = await response.json();
      
      if (response.ok) {
        await fetchEstimates();
      } else {
        setSyncError(data.error || 'Failed to sync estimates');
        if (data.requiresReauth) {
          setSyncError('Please reconnect your GoHighLevel integration to enable estimate access.');
        }
        if (data.requiresPIT) {
          setSyncError('Estimates require a Private Integration Token. Please go to GHL Settings and add your PIT under the MCP section.');
        }
      }
    } catch (error) {
      console.error('Error syncing estimates:', error);
      setSyncError('An error occurred while syncing estimates');
    } finally {
      setSyncing(false);
    }
  };

  const filteredEstimates = estimates.filter(estimate => {
    const matchesSearch = searchTerm ? 
      estimate.estimate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.contact_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.opportunity_id?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    return matchesSearch;
  });

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.draft}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getConversionRate = () => {
    const total = estimates.length;
    const accepted = estimates.filter(est => est.status === 'accepted').length;
    return total === 0 ? 0 : Math.round((accepted / total) * 100);
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
          <span className="text-gray-600">Loading estimates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Estimates</h2>
            <p className="text-gray-600">Track estimate status and conversion rates</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingEstimate(null);
              setShowEstimateBuilder(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Estimate</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={syncEstimates}
            disabled={syncing || !selectedIntegration}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Estimates'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
            <p className="text-sm">{syncError}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <Calculator className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Estimates</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <Send className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Sent</p>
              <p className="text-2xl font-bold text-gray-900">
                {estimates.filter(est => est.status === 'sent').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-gray-900">
                {estimates.filter(est => est.status === 'accepted').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Declined</p>
              <p className="text-2xl font-bold text-gray-900">
                {estimates.filter(est => est.status === 'declined').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">%</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{getConversionRate()}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search estimates, numbers, or contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estimates List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredEstimates.length === 0 ? (
          <div className="text-center py-12">
            <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No estimates found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Your estimates will appear here once they are created in GoHighLevel.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {estimate.estimate_number}
                        </div>
                        {estimate.opportunity_id && (
                          <div className="text-sm text-gray-500">
                            Opp: {estimate.opportunity_id.slice(-8)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {estimate.contact_name || estimate.contact_id || 'Unknown'}
                          </div>
                          {estimate.contact_email && (
                            <div className="text-sm text-gray-500">
                              {estimate.contact_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(estimate.amount, estimate.currency)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={estimate.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(estimate.estimate_date)}
                      </div>
                      {estimate.valid_until && (
                        <div className="text-xs text-gray-400 mt-1">
                          Valid until: {formatDate(estimate.valid_until)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setSelectedEstimate(estimate)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                        {estimate.status === 'draft' && (
                          <button
                            onClick={() => {
                              setEditingEstimate(estimate);
                              setShowEstimateBuilder(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
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

      {/* Estimate Detail Modal */}
      {selectedEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Estimate Details</h3>
                <button
                  onClick={() => setSelectedEstimate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Estimate Number</label>
                    <p className="text-sm text-gray-900">
                      {selectedEstimate.estimate_number}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedEstimate.status} />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(selectedEstimate.amount, selectedEstimate.currency)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contact</label>
                    <p className="text-sm text-gray-900">
                      {selectedEstimate.contact_name || selectedEstimate.contact_id || 'Unknown'}
                    </p>
                    {selectedEstimate.contact_email && (
                      <p className="text-sm text-gray-500">{selectedEstimate.contact_email}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedEstimate.estimate_date)}</p>
                  </div>
                  {selectedEstimate.sent_date && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Sent Date</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedEstimate.sent_date)}</p>
                    </div>
                  )}
                </div>
                
                {selectedEstimate.valid_until && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Valid Until</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedEstimate.valid_until)}</p>
                  </div>
                )}
                
                {selectedEstimate.opportunity_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Opportunity ID</label>
                    <p className="text-sm text-gray-900">{selectedEstimate.opportunity_id}</p>
                  </div>
                )}
                
                {selectedEstimate.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-sm text-gray-900">{selectedEstimate.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-sm text-gray-500">
        Showing {filteredEstimates.length} of {totalCount} estimates
      </div>

      {/* Estimate Builder Modal */}
      {showEstimateBuilder && (
        <EstimateBuilder
          estimate={editingEstimate}
          integrationId={selectedIntegration}
          onClose={() => {
            setShowEstimateBuilder(false);
            setEditingEstimate(null);
          }}
          onSave={async (estimateData) => {
            try {
              const endpoint = editingEstimate 
                ? `/api/sales/estimates/${editingEstimate.id}/update`
                : '/api/sales/estimates/create';
              
              const method = editingEstimate ? 'PUT' : 'POST';
              
              const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  ...estimateData,
                  integration_id: selectedIntegration
                })
              });

              if (response.ok) {
                await fetchEstimates();
                setShowEstimateBuilder(false);
                setEditingEstimate(null);
              } else {
                const error = await response.json();
                console.error('Error saving estimate:', error);
                alert('Failed to save estimate: ' + (error.error || 'Unknown error'));
              }
            } catch (error) {
              console.error('Error saving estimate:', error);
              alert('Failed to save estimate. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}