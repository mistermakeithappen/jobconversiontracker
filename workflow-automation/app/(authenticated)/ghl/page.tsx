'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Receipt, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  MessageSquare,
  Unlink
} from 'lucide-react';

interface Integration {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  name: string;
  config: Record<string, unknown>;
  lastSync?: string;
  contactCount?: number;
  opportunityCount?: number;
}

export default function GHLOverviewPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOpportunities: 0,
    totalReceipts: 0,
    recentSMSCount: 0
  });

  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  useEffect(() => {
    if (integration?.status === 'connected') {
      fetchStats();
    }
  }, [integration]);

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      if (response.ok && data.connected) {
        setIntegration({
          id: data.integrationId || 'ghl-integration',
          status: 'connected',
          name: 'GoHighLevel',
          config: data.integration?.config || {},
          lastSync: new Date().toISOString()
        });
      } else {
        setIntegration({
          id: 'ghl-integration',
          status: 'disconnected',
          name: 'GoHighLevel',
          config: {}
        });
      }
    } catch (error) {
      console.error('Error fetching integration status:', error);
      setIntegration({
        id: 'ghl-integration',
        status: 'disconnected',
        name: 'GoHighLevel',
        config: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Only fetch stats if we're connected
      if (integration?.status !== 'connected') return;
      
      // Fetch various stats from different endpoints
      const [contactsRes, opportunitiesRes] = await Promise.all([
        fetch('/api/integrations/automake/contacts'),
        fetch('/api/integrations/automake/opportunities')
      ]);
      
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setStats(prev => ({ ...prev, totalContacts: contactsData.contacts?.length || 0 }));
      }
      
      if (opportunitiesRes.ok) {
        const oppsData = await opportunitiesRes.json();
        setStats(prev => ({ ...prev, totalOpportunities: oppsData.opportunities?.length || 0 }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
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

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from GoHighLevel? This will remove access to contacts, opportunities, and other GHL features.')) {
      return;
    }

    try {
      const response = await fetch('/api/integrations/automake/disconnect', {
        method: 'POST'
      });

      if (response.ok) {
        // Refresh the page to show disconnected state
        window.location.reload();
      } else {
        alert('Failed to disconnect from GoHighLevel');
      }
    } catch (error) {
      console.error('Error disconnecting from GHL:', error);
      alert('Error disconnecting from GoHighLevel');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  };

  const quickActions = [
    {
      title: 'Sync Contacts',
      description: 'Update contact database from GoHighLevel',
      href: '/ghl/contacts',
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'View Pipeline',
      description: 'Manage opportunities and track profitability',
      href: '/ghl/opportunities',
      icon: DollarSign,
      color: 'bg-green-500'
    },
    {
      title: 'Test AI Receipts',
      description: 'Process receipt images with AI',
      href: '/test-receipt-ai',
      icon: Receipt,
      color: 'bg-purple-500'
    },
    {
      title: 'Admin Settings',
      description: 'Manage payment structures and credit cards',
      href: '/ghl/settings',
      icon: Settings,
      color: 'bg-gray-500'
    }
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  // If not connected, show only the connection card
  if (integration?.status === 'disconnected') {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Link your GoHighLevel account to access contacts, opportunities, receipt processing, and team management features.
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Connect GoHighLevel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Connection Status</h2>
          <div className="flex items-center space-x-3">
            {integration && (
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${getStatusColor(integration.status)}`}>
                {getStatusIcon(integration.status)}
                <span className="text-sm font-medium capitalize">{integration.status}</span>
              </div>
            )}
            {integration?.status === 'connected' && (
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
              >
                <Unlink className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Account Name</p>
            <p className="text-lg font-medium text-gray-900">{integration?.config?.locationName || 'Connected Account'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Location ID</p>
            <p className="text-sm font-mono text-gray-700">{integration?.config?.locationId || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last Sync</p>
            <p className="text-sm text-gray-700">
              {integration?.lastSync ? new Date(integration.lastSync).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalContacts.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOpportunities.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Receipts Processed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReceipts.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">SMS Messages</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentSMSCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-all hover:shadow-sm"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-medium text-gray-900 group-hover:text-gray-700">{action.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity - Placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p>Activity tracking coming soon...</p>
        </div>
      </div>
    </div>
  );
}