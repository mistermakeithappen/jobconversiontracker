'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DollarSign, RefreshCw, CheckCircle, Plus } from 'lucide-react';
import { OpportunitiesPipelineView } from '@/components/ghl/opportunities-pipeline-view';
import { getSupabaseClient } from '@/lib/auth/client';

interface GHLOpportunity {
  id: string;
  name: string;
  contactName: string;
  pipelineName: string;
  stageName: string;
  status: string;
  monetaryValue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface GHLPipeline {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    position: number;
  }>;
}

export default function GHLOpportunitiesPage() {
  const searchParams = useSearchParams();
  const [opportunities, setOpportunities] = useState<GHLOpportunity[]>([]);
  const [pipelines, setPipelines] = useState<GHLPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'needs-reconnection'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [openOpportunityId, setOpenOpportunityId] = useState<string | null>(null);
  const [reconnectionReason, setReconnectionReason] = useState<string | null>(null);
  const [paginationInfo, setPaginationInfo] = useState<{
    requestCount?: number;
    totalFetched?: number;
    maxResultsReached?: boolean;
  } | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    if (connected) {
      // First load from database for fast display
      fetchOpportunities();
      // Then sync with GHL in background
      syncInBackground();
    }
  }, [connected]);

  useEffect(() => {
    // Check for openOpportunity query parameter
    const opportunityId = searchParams.get('openOpportunity');
    if (opportunityId && opportunities.length > 0) {
      // Find the opportunity and set it to open
      const opportunity = opportunities.find(opp => opp.id === opportunityId);
      if (opportunity) {
        setOpenOpportunityId(opportunityId);
      }
    }
  }, [searchParams, opportunities]);

  const checkConnectionStatus = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/status', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
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

  const syncInBackground = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Sync with GHL in background without loading state
      const syncResponse = await fetch('/api/integrations/automake/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      
      if (syncResponse.ok) {
        // Refresh opportunities after sync completes
        await fetchOpportunities();
      }
    } catch (error) {
      console.error('Error syncing opportunities in background:', error);
    }
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Add fromCache parameter to load from database first
      const response = await fetch('/api/integrations/automake/opportunities?fromCache=true', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setOpportunities(data.opportunities || []);
        setPipelines(data.pipelines || []);
        
        // Set pagination info if available
        if (data.requestCount || data.totalFetched) {
          setPaginationInfo({
            requestCount: data.requestCount,
            totalFetched: data.totalFetched,
            maxResultsReached: data.maxResultsReached
          });
        }
        
        console.log('Opportunities fetched:', {
          count: data.opportunities?.length || 0,
          pipelines: data.pipelines?.length || 0,
          requestCount: data.requestCount,
          totalFetched: data.totalFetched,
          fromCache: data.fromCache
        });
        
        // Debug: Log first opportunity to see data structure
        if (data.opportunities && data.opportunities.length > 0) {
          console.log('First opportunity data:', data.opportunities[0]);
        }
      } else {
        console.error('Error fetching opportunities:', data.error);
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      
      if (response.ok) {
        // When syncing, fetch fresh data from GHL, not cache
        const freshResponse = await fetch('/api/integrations/automake/opportunities', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          }
        });
        const data = await freshResponse.json();
        
        if (freshResponse.ok) {
          setOpportunities(data.opportunities || []);
          setPipelines(data.pipelines || []);
            
          if (data.requestCount || data.totalFetched) {
            setPaginationInfo({
              requestCount: data.requestCount,
              totalFetched: data.totalFetched,
              maxResultsReached: data.maxResultsReached
            });
          }
        }
        alert('Opportunities synced successfully!');
      } else {
        alert('Failed to sync opportunities');
      }
    } catch (error) {
      console.error('Error syncing opportunities:', error);
      alert('Error syncing opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/connect', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
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
        <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel to view opportunities</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Link your GHL account to sync opportunities and track profitability
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Opportunities</h2>
          <p className="text-gray-600">Pipeline view with profitability tracking and receipt management</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </span>
          <button
            onClick={syncData}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      
      {/* Pipeline View */}
      {integrationId && (
        <OpportunitiesPipelineView
          opportunities={opportunities}
          pipelines={pipelines}
          integrationId={integrationId}
          onRefresh={fetchOpportunities}
          openOpportunityId={openOpportunityId}
          onOpportunityOpened={() => setOpenOpportunityId(null)}
        />
      )}
    </div>
  );
}