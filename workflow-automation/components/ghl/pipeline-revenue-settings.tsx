'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, CheckCircle, AlertCircle, Save, Key, ExternalLink } from 'lucide-react';
import { getSupabaseClient } from '@/lib/auth/client';
import Link from 'next/link';

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  isRevenueStage: boolean;
  isCompletionStage: boolean;
  revenueConfidence?: number;
  revenueReasoning?: string;
  completionConfidence?: number;
  completionReasoning?: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface PipelineRevenueSettingsProps {
  integrationId: string;
}

export function PipelineRevenueSettings({ integrationId }: PipelineRevenueSettingsProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [changes, setChanges] = useState<Record<string, { revenueStageId?: string; completionStageId?: string }>>({});
  const [openAIKeyMissing, setOpenAIKeyMissing] = useState(false);

  useEffect(() => {
    fetchPipelineData();
  }, [integrationId]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch pipelines from GHL
      const response = await fetch('/api/integrations/automake/opportunities', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched pipeline data:', data.pipelines);
        if (data.pipelines) {
          setPipelines(data.pipelines);
          
          // Log which stages are marked as revenue/completion
          data.pipelines.forEach((pipeline: any) => {
            const revenueStage = pipeline.stages?.find((s: any) => s.isRevenueStage);
            const completionStage = pipeline.stages?.find((s: any) => s.isCompletionStage);
            if (revenueStage || completionStage) {
              console.log(`Pipeline ${pipeline.name}:`, {
                revenue: revenueStage?.name,
                completion: completionStage?.name
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAIAnalysis = async () => {
    try {
      setAnalyzing(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/pipelines/analyze-stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          pipelines,
          integrationId
        })
      });
      
      if (response.ok) {
        // Refresh pipeline data to show new analysis
        await fetchPipelineData();
        alert('Pipeline analysis completed successfully!');
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorData = { error: 'Server error - unable to parse response' };
        }
        
        console.error('Analysis error:', errorData);
        
        // Check for specific error types
        if (errorData.error?.includes('OpenAI API key not found')) {
          setOpenAIKeyMissing(true);
          // Don't show alert, we'll show a better UI element
        } else if (errorData.error?.includes('OpenAI API error')) {
          alert(`OpenAI API Error:\n\n${errorData.details || errorData.error}\n\nPlease check your API key and try again.`);
        } else {
          alert(errorData.error || 'Failed to analyze pipelines. Please check the console for details.');
        }
      }
    } catch (error) {
      console.error('Error analyzing pipelines:', error);
      alert('Error analyzing pipelines. Please check the browser console for details.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStageChange = (pipelineId: string, stageType: 'revenue' | 'completion', stageId: string) => {
    // Get the current stages from the pipeline data
    const pipeline = pipelines.find(p => p.id === pipelineId);
    const currentRevenueStage = pipeline?.stages.find(s => s.isRevenueStage);
    const currentCompletionStage = pipeline?.stages.find(s => s.isCompletionStage);
    
    setChanges(prev => {
      const existingChanges = prev[pipelineId] || {};
      
      // Preserve the other stage type's value
      const revenueStageId = stageType === 'revenue' 
        ? stageId 
        : (existingChanges.revenueStageId !== undefined 
            ? existingChanges.revenueStageId 
            : currentRevenueStage?.id || '');
      
      const completionStageId = stageType === 'completion' 
        ? stageId 
        : (existingChanges.completionStageId !== undefined 
            ? existingChanges.completionStageId 
            : currentCompletionStage?.id || '');
      
      return {
        ...prev,
        [pipelineId]: {
          revenueStageId,
          completionStageId
        }
      };
    });
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Saving changes:', { integrationId, changes });
      
      const response = await fetch('/api/pipelines/update-stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          integrationId,
          changes
        })
      });
      
      const responseData = await response.json();
      console.log('Save response:', responseData);
      
      if (response.ok) {
        setChanges({});
        await fetchPipelineData();
        alert('Pipeline settings saved successfully');
      } else {
        console.error('Save failed:', responseData);
        alert(responseData.error || 'Failed to save pipeline settings');
      }
    } catch (error) {
      console.error('Error saving pipeline settings:', error);
      alert('Error saving pipeline settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Check if pipelines have been analyzed
  const hasBeenAnalyzed = pipelines.some(p => 
    p.stages?.some(s => s.isRevenueStage || s.isCompletionStage)
  );

  return (
    <div className="space-y-6">
      {/* OpenAI Key Missing Alert */}
      {openAIKeyMissing && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Key className="w-6 h-6 text-red-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-red-900 mb-2">OpenAI API Key Required</h4>
              <p className="text-sm text-red-800 mb-4">
                To use AI-powered pipeline analysis, you need to add your OpenAI API key to your organization settings.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/integrations"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Add OpenAI API Key
                </Link>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  Get API Key
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
                <button
                  onClick={() => {
                    setOpenAIKeyMissing(false);
                    runAIAnalysis();
                  }}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </button>
              </div>
              <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
                <p className="text-xs text-red-700">
                  <strong>How to get an API key:</strong>
                </p>
                <ol className="text-xs text-red-600 list-decimal list-inside mt-1 space-y-1">
                  <li>Click "Get API Key" above to go to OpenAI's platform</li>
                  <li>Sign in or create an OpenAI account</li>
                  <li>Navigate to API Keys section</li>
                  <li>Create a new secret key</li>
                  <li>Copy the key and add it in your settings</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pipeline Revenue Recognition Settings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure which stages represent revenue recognition and commission points
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAIAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : hasBeenAnalyzed ? 'Re-run Analysis' : 'Run AI Analysis (Required)'}
          </button>
          {Object.keys(changes).length > 0 && (
            <button
              onClick={saveChanges}
              disabled={saving || !hasBeenAnalyzed}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              title={!hasBeenAnalyzed ? 'Run AI Analysis first before saving' : ''}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
      
      {/* Setup Instructions for new users */}
      {!hasBeenAnalyzed && pipelines.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-amber-900 mb-2">Setup Required - Please Follow These Steps:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-amber-800">
                <li className="font-medium">
                  <span className="font-bold">Ensure OpenAI API key is configured</span> - The AI analysis requires an OpenAI API key in your organization settings
                </li>
                <li className="font-medium">
                  <span className="font-bold">Click "Run AI Analysis (Required)"</span> - This will analyze your pipelines and create the necessary database records
                </li>
                <li>
                  <span className="font-medium">Wait for analysis to complete</span> - The system will identify revenue and commission stages automatically
                </li>
                <li>
                  <span className="font-medium">Review and adjust if needed</span> - After analysis, you can override the AI's suggestions using the dropdowns
                </li>
                <li>
                  <span className="font-medium">Save your changes</span> - Your custom settings will be preserved for future use
                </li>
              </ol>
              <div className="mt-4 p-3 bg-amber-100 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>Requirements:</strong>
                </p>
                <ul className="text-xs text-amber-700 list-disc list-inside mt-1">
                  <li>OpenAI API key must be configured in organization settings</li>
                  <li>AI analysis must be run at least once to initialize pipeline data</li>
                  <li>Without these steps, your changes cannot be saved</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-600">Pre-Revenue Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Revenue Counting Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">Revenue Recognition Point</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span className="text-gray-600">Commission Due Point</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {pipelines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No pipelines found. Please connect to GoHighLevel first.
            </div>
          ) : (
            pipelines.map(pipeline => {
              const currentRevenueStage = pipeline.stages.find(s => s.isRevenueStage);
              const currentCompletionStage = pipeline.stages.find(s => s.isCompletionStage);
              const pipelineChanges = changes[pipeline.id];
              
              return (
                <div key={pipeline.id} className="p-4">
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900">{pipeline.name}</h4>
                    <p className="text-sm text-gray-600">{pipeline.stages.length} stages</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Revenue Recognition Stage
                      </label>
                      <select
                        value={pipelineChanges?.revenueStageId || currentRevenueStage?.id || ''}
                        onChange={(e) => handleStageChange(pipeline.id, 'revenue', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">None (Pre-revenue only)</option>
                        {pipeline.stages.map(stage => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name} (Position {stage.position})
                          </option>
                        ))}
                      </select>
                      {currentRevenueStage?.revenueConfidence && (
                        <p className="text-xs text-gray-500 mt-1">
                          AI Confidence: {(currentRevenueStage.revenueConfidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Commission Due Stage
                      </label>
                      <select
                        value={pipelineChanges?.completionStageId || currentCompletionStage?.id || ''}
                        onChange={(e) => handleStageChange(pipeline.id, 'completion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">None</option>
                        {pipeline.stages.map(stage => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name} (Position {stage.position})
                          </option>
                        ))}
                      </select>
                      {currentCompletionStage?.completionConfidence && (
                        <p className="text-xs text-gray-500 mt-1">
                          AI Confidence: {(currentCompletionStage.completionConfidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pipeline.stages.map(stage => {
                      const isRevenue = (pipelineChanges?.revenueStageId === stage.id) || 
                                       (!pipelineChanges?.revenueStageId && stage.isRevenueStage);
                      const isCompletion = (pipelineChanges?.completionStageId === stage.id) || 
                                          (!pipelineChanges?.completionStageId && stage.isCompletionStage);
                      const isPostRevenue = isRevenue || 
                                           (currentRevenueStage && stage.position > currentRevenueStage.position) ||
                                           (pipelineChanges?.revenueStageId && 
                                            stage.position > (pipeline.stages.find(s => s.id === pipelineChanges.revenueStageId)?.position || 0));
                      
                      return (
                        <div
                          key={stage.id}
                          className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                            isPostRevenue 
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}
                        >
                          {stage.name}
                          {isRevenue && <TrendingUp className="w-3 h-3 ml-1" />}
                          {isCompletion && <CheckCircle className="w-3 h-3 ml-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {pipelines.length > 0 && hasBeenAnalyzed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">Pipeline Analysis Complete!</p>
              <p className="text-green-700">
                Your pipelines have been analyzed. You can now customize the revenue and commission stages below.
                Changes will be saved and applied across the platform.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {pipelines.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-gray-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Understanding Revenue Recognition:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li><span className="text-red-600 font-medium">Red stages</span> = Pre-revenue (estimates, proposals, negotiations)</li>
                <li><span className="text-green-600 font-medium">Green stages</span> = Revenue counted (closed won and beyond)</li>
                <li><span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Revenue badge</span> = First stage where revenue is recognized</li>
                <li><span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Commission badge</span> = Stage where commissions are due</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}