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
  Unlink,
  Brain,
  RefreshCw
} from 'lucide-react';

interface Integration {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  name: string;
  config: Record<string, unknown>;
  lastSync?: string;
  contactCount?: number;
  opportunityCount?: number;
  analyzedPipelines?: number;
  lastPipelineAnalysis?: string;
}

export default function DashboardPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);
  const [analysisDetails, setAnalysisDetails] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOpportunities: 0,
    totalReceipts: 0,
    recentSMSCount: 0
  });

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    // Since we're using httpOnly cookies, we don't need to send auth headers
    // The cookies will be automatically included in the request
    return {
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  // Redirect to login on auth error
  useEffect(() => {
    if (integration?.status === 'error' && 
        (integration.name === 'Authentication required' || 
         integration.name === 'Token expired')) {
      window.location.href = '/login';
    }
  }, [integration]);

  useEffect(() => {
    if (integration?.status === 'connected') {
      fetchStats();
      if (showAnalysisDetails) {
        fetchAnalysisDetails();
      }
    }
  }, [integration, showAnalysisDetails]);

  const fetchIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      
      let data;
      
      if (!response.ok) {
        console.error('Status API error:', response.status, response.statusText);
        try {
          data = await response.json();
          console.error('Error response:', data);
        } catch {
          const text = await response.text();
          console.error('Error response text:', text);
          data = { error: text };
        }
        
        // Handle authentication errors
        if (response.status === 401) {
          setIntegration({
            id: 'auth-error',
            status: 'error',
            name: 'Authentication required',
            config: {}
          });
          return;
        }
      } else {
        data = await response.json();
      }
      if (response.ok && data.connected) {
        const config = data.integration?.config || {};
        const pipelineStages = data.integration?.pipeline_completion_stages;
        
        console.log('Integration data:', data.integration);
        console.log('Pipeline completion stages:', pipelineStages);
        
        setIntegration({
          id: data.integrationId || 'ghl-integration',
          status: 'connected',
          name: 'GoHighLevel',
          config: config,
          lastSync: config.lastTokenRefresh || new Date().toISOString(),
          analyzedPipelines: pipelineStages && typeof pipelineStages === 'object' ? 
            Object.keys(pipelineStages).length : 0,
          lastPipelineAnalysis: data.integration?.last_pipeline_analysis
        });
      } else {
        setIntegration({
          id: 'ghl-integration',
          status: 'disconnected',
          name: 'GoHighLevel',
          config: {},
          analyzedPipelines: 0
        });
      }
    } catch (error) {
      console.error('Error fetching integration status:', error);
      setIntegration({
        id: 'ghl-integration',
        status: 'disconnected',
        name: 'GoHighLevel',
        config: {},
        analyzedPipelines: 0
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
      const response = await fetch('/api/integrations/automake/connect', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();

      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to connect:', data);
        alert(data.error || 'Failed to initiate connection to GoHighLevel');
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

  const fetchAnalysisDetails = async () => {
    if (!integration?.id) return;
    
    // Reset state first
    console.log('Resetting analysisDetails state');
    setAnalysisDetails([]);
    
    try {
      const headers = await getAuthHeaders();
      
      // First run debug to see what's in the database
      const debugResponse = await fetch(`/api/debug/pipeline-data?integrationId=${integration.id}`, { headers });
      if (debugResponse.ok) {
        const debugData = await debugResponse.json();
        console.log('=== DEBUG: Pipeline Analysis Data ===');
        console.log('User ID:', debugData.userId);
        console.log('Integration ID:', debugData.integrationId);
        console.log('Integration exists:', debugData.integration);
        console.log('All stages in DB:', debugData.allStages);
        console.log('Integration stages:', debugData.integrationStages);
        console.log('Completion stages:', debugData.completionStages);
        console.log('=======================================');
      }

      // Then try to fetch analysis details
      const response = await fetch(`/api/pipelines/analysis-details?integrationId=${integration.id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('Analysis details response:', data);
        console.log('Setting analysisDetails to:', data.pipelines);
        console.log('analysisDetails length:', data.pipelines?.length || 0);
        
        // Force a fresh array to ensure React recognizes the state change
        const freshPipelines = Array.isArray(data.pipelines) ? [...data.pipelines] : [];
        console.log('Fresh pipelines array:', freshPipelines);
        
        // If we have data, set it directly
        if (freshPipelines.length > 0) {
          console.log('Setting real pipeline data:', freshPipelines);
          setAnalysisDetails(freshPipelines);
        } else {
          // If no data returned, create a fallback message
          console.log('No pipeline data returned, creating fallback');
          const fallbackData = [{
            pipeline_id: 'fallback',
            pipeline_name: 'Analysis Complete',
            analyzed_at: new Date().toISOString(),
            completion_stages: [{
              stage_id: 'no-stage',
              stage_name: 'No Results',
              confidence: 0,
              reasoning: 'Pipeline analysis completed but no fulfillment completion stages were identified. The AI may have determined that the available stages do not indicate completed work delivery.'
            }]
          }];
          setAnalysisDetails(fallbackData);
        }
      } else {
        console.error('Analysis details API failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching analysis details:', error);
    }
  };

  const analyzeCompletionStages = async () => {
    if (!integration?.id) return;
    
    setAnalyzing(true);
    try {
      const headers = await getAuthHeaders();
      
      // First, fetch pipelines
      const pipelinesRes = await fetch('/api/integrations/automake/pipelines', { headers });
      if (!pipelinesRes.ok) {
        throw new Error('Failed to fetch pipelines');
      }
      
      const pipelinesData = await pipelinesRes.json();
      
      // Then analyze the stages
      const analyzeRes = await fetch('/api/pipelines/analyze-stages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pipelines: pipelinesData.pipelines,
          integrationId: integration.id
        })
      });
      
      if (!analyzeRes.ok) {
        const error = await analyzeRes.json();
        throw new Error(error.error || 'Failed to analyze pipeline stages');
      }
      
      const result = await analyzeRes.json();
      
      // Show success message and refresh integration status
      alert(`Successfully analyzed ${result.analyzed_count} pipelines!`);
      await fetchIntegrationStatus(); // Refresh to show updated analysis count
      await fetchAnalysisDetails(); // Fetch the latest analysis details
      
    } catch (error) {
      console.error('Error analyzing pipeline stages:', error);
      if (error instanceof Error && error.message.includes('OpenAI API key not found')) {
        alert('Please add your OpenAI API key in Settings before analyzing pipelines.');
      } else {
        alert(error instanceof Error ? error.message : 'Failed to analyze pipeline stages');
      }
    } finally {
      setAnalyzing(false);
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
        
        {/* Pipeline Analysis Status */}
        {integration?.status === 'connected' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">
                  AI Pipeline Analysis
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View Details
                </button>
                <button
                  onClick={async () => {
                    if (integration?.id) {
                      try {
                        const headers = await getAuthHeaders();
                        const response = await fetch(`/api/debug/pipeline-data?integrationId=${integration.id}`, { headers });
                        const data = await response.json();
                        console.log('DEBUG DATA:', data);
                        alert('Debug data logged to console - check F12 > Console');
                      } catch (error) {
                        console.error('Debug error:', error);
                        alert('Failed to fetch debug data');
                      }
                    }
                  }}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Debug
                </button>
                <button
                  onClick={analyzeCompletionStages}
                  disabled={analyzing}
                  className="inline-flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-analyze</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {integration?.analyzedPipelines || 0} pipelines analyzed for commission-eligible completion stages
              {integration?.lastPipelineAnalysis && (
                <span className="block text-xs text-gray-400 mt-0.5">
                  Last analyzed: {new Date(integration.lastPipelineAnalysis).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Pipeline Analysis Details */}
      {showAnalysisDetails && integration?.status === 'connected' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Analysis Results</h3>
          
          {(() => {
            console.log('Rendering analysis details, length:', analysisDetails.length);
            console.log('Analysis details data:', analysisDetails);
            return null;
          })()}
          
          {analysisDetails.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pipeline analysis results found.</p>
              <p className="text-sm text-gray-400 mt-2">
                Click "Re-analyze" to analyze your pipelines for commission-eligible stages.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {analysisDetails.map((pipeline) => (
                <div key={pipeline.pipeline_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{pipeline.pipeline_name}</h4>
                    <span className="text-xs text-gray-500">
                      {pipeline.analyzed_at ? new Date(pipeline.analyzed_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  
                  {pipeline.completion_stages.map((stage: any, index: number) => (
                    <div key={stage.stage_id} className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-green-800">
                          🎯 Commission Stage: "{stage.stage_name}"
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {Math.round((stage.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                      {stage.reasoning && (
                        <p className="text-sm text-green-700 bg-green-100 p-2 rounded">
                          <strong>AI Reasoning:</strong> {stage.reasoning}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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