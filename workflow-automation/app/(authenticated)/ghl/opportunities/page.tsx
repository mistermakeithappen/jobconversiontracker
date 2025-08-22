'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DollarSign, RefreshCw, CheckCircle, Plus } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';
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
    isRevenueStage?: boolean;
    isCompletionStage?: boolean;
  }>;
}

export default function GHLOpportunitiesPage() {
  console.log('🚀 OPPORTUNITIES PAGE: Component is rendering');
  const searchParams = useSearchParams();
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  
  console.log('🔍 SUBSCRIPTION HOOK VALUES:', {
    hasActiveSubscription,
    subscriptionLoading,
    trialEnded,
    typeof_hasActiveSubscription: typeof hasActiveSubscription,
    typeof_subscriptionLoading: typeof subscriptionLoading
  });
  const [opportunities, setOpportunities] = useState<GHLOpportunity[]>([]);
  const [pipelines, setPipelines] = useState<GHLPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'needs-reconnection'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [openOpportunityId, setOpenOpportunityId] = useState<string | null>(null);
  const [reconnectionReason, setReconnectionReason] = useState<string | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paginationInfo, setPaginationInfo] = useState<{
    requestCount?: number;
    totalFetched?: number;
    maxResultsReached?: boolean;
  } | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
    
    if (connected && hasActiveSubscription) {
      // First load from database for fast display
      fetchOpportunities();
      // Then sync with GHL in background after a short delay
      const syncTimer = setTimeout(() => {
        syncInBackground();
      }, 1000); // Wait 1 second to let the page fully load
      
      return () => clearTimeout(syncTimer);
    }
  }, [connected, hasActiveSubscription, subscriptionLoading]);

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

  // DEBUG: Show subscription values
  console.log('🔍 OPPORTUNITIES DEBUG:', {
    subscriptionLoading,
    hasActiveSubscription,
    trialEnded,
    shouldBlock: !subscriptionLoading && !hasActiveSubscription,
    CRITICAL_CHECK: 'This should block content and prevent Connect GHL button'
  });

  // CRITICAL SECURITY: Don't show content if no subscription - BLOCK CONTENT COMPLETELY
  console.log('🔎 CONDITIONAL CHECK:', {
    '!subscriptionLoading': !subscriptionLoading,
    '!hasActiveSubscription': !hasActiveSubscription,
    'BOTH_TRUE': (!subscriptionLoading && !hasActiveSubscription),
    'SHOULD_BLOCK': (!subscriptionLoading && !hasActiveSubscription) ? 'YES - BLOCKING' : 'NO - ALLOWING'
  });
  
  if (!subscriptionLoading && !hasActiveSubscription) {
    console.log('🛑 SECURITY BLOCK: Preventing access to GHL content - RETURNING PAYWALL');  
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <DollarSign className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing GoHighLevel opportunities tracking.'
              : 'Access powerful opportunities pipeline tracking, profitability analysis, and automation tools with a premium subscription.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={async () => {
                try {
                  if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
                    window.location.href = '/pricing';
                    return;
                  }

                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
                      successUrl: window.location.origin + '/ghl/opportunities?upgraded=true',
                      cancelUrl: window.location.href,
                    }),
                  });

                  if (!response.ok) throw new Error('Failed to create checkout session');
                  const { url } = await response.json();
                  if (url) {
                    window.location.href = url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (error) {
                  console.error('Error creating checkout session:', error);
                  window.location.href = '/pricing';
                }
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors border border-gray-300"
            >
              View Pricing
            </button>
          </div>
        </div>

        {/* Paywall Modal - Non-dismissible */}
        <PaywallModal
          isOpen={showPaywallModal}
          onClose={() => {}} // Prevent dismissal
          feature="Opportunities Pipeline"
          trialEnded={trialEnded}
        />
      </div>
    );
  }

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
      
      console.log('Starting background sync...');
      setBackgroundSyncing(true);
      
      // Fetch fresh data from GHL (not from cache) without showing loading state
      const freshResponse = await fetch('/api/integrations/automake/opportunities', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      
      if (freshResponse.ok) {
        const data = await freshResponse.json();
        console.log('Background sync completed:', {
          opportunities: data.opportunities?.length || 0,
          pipelines: data.pipelines?.length || 0
        });
        
        // Update the state with fresh data
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
    } catch (error) {
      console.error('Error syncing opportunities in background:', error);
    } finally {
      setBackgroundSyncing(false);
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
      {/* Header - Centered */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Opportunities</h2>
            <p className="text-gray-600">Pipeline view with profitability tracking and receipt management</p>
          </div>
          <div className="flex items-center space-x-3">
            {backgroundSyncing && (
              <span className="flex items-center space-x-2 text-sm text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Syncing...</span>
              </span>
            )}
            <span className="flex items-center space-x-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Connected</span>
            </span>
            <button
              onClick={syncData}
              disabled={loading || backgroundSyncing}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Data</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Pipeline View - Full Width */}
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
      
      {/* THIS SHOULD NEVER SHOW IF BLOCKING WORKS */}
      {console.log('🚨 ERROR: Reached end of component - blocking failed!')}
      
    </div>
  );
}