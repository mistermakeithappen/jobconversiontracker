'use client';

import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, CheckCircle, Plus } from 'lucide-react';
import { OpportunitiesPipelineView } from '@/components/ghl/opportunities-pipeline-view';

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
  const [opportunities, setOpportunities] = useState<GHLOpportunity[]>([]);
  const [pipelines, setPipelines] = useState<GHLPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [isUsingRealData, setIsUsingRealData] = useState<boolean | null>(null);
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
      fetchOpportunities();
    }
  }, [connected]);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      setConnected(data.connected);
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      if (data.integrationId) {
        setIntegrationId(data.integrationId);
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/automake/opportunities');
      const data = await response.json();
      
      if (response.ok) {
        setOpportunities(data.opportunities || []);
        setPipelines(data.pipelines || []);
        setIsUsingRealData(data.isRealData || false);
        
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
          isRealData: data.isRealData,
          pipelines: data.pipelines?.length || 0,
          requestCount: data.requestCount,
          totalFetched: data.totalFetched
        });
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
      const response = await fetch('/api/integrations/automake/sync', {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchOpportunities();
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

      {/* Data Source Status */}
      {isUsingRealData === true ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800">Real Data Connected</h4>
              <p className="text-sm text-green-700 mt-1">
                Successfully connected to GoHighLevel opportunities API. 
                Showing live data from your subaccount ({opportunities.length} opportunities found
                {paginationInfo?.requestCount && ` via ${paginationInfo.requestCount} API requests`}).
                Pipeline stages are displayed in the same order as configured in GoHighLevel.
                {paginationInfo?.maxResultsReached && (
                  <span className="font-medium"> Note: Reached maximum limit of 5,000 opportunities.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : isUsingRealData === false ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 text-yellow-600 mt-0.5">⚠️</div>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Using Sample Data</h4>
              <p className="text-sm text-yellow-700 mt-1">
                GoHighLevel opportunities API may not be accessible. 
                Showing sample data based on your pipelines. Click &quot;Sync Data&quot; to retry fetching real opportunities.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5 animate-spin" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">Checking Data Source</h4>
              <p className="text-sm text-blue-700 mt-1">
                Determining whether to use real GoHighLevel data or sample data...
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Pipeline View */}
      {integrationId && (
        <OpportunitiesPipelineView
          opportunities={opportunities}
          pipelines={pipelines}
          integrationId={integrationId}
          onRefresh={fetchOpportunities}
        />
      )}
    </div>
  );
}