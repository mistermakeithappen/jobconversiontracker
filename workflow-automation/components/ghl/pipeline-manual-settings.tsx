'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, Save, AlertCircle } from 'lucide-react';
import { getSupabaseClient } from '@/lib/auth/client';

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface PipelineManualSettingsProps {
  integrationId: string;
}

export function PipelineManualSettings({ integrationId }: PipelineManualSettingsProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Record<string, { revenueStageId?: string; completionStageId?: string }>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPipelineData();
  }, [integrationId]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      setMessage(null);
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
          
          // Load existing selections
          const existingSelections: Record<string, { revenueStageId?: string; completionStageId?: string }> = {};
          data.pipelines.forEach((pipeline: any) => {
            const revenueStage = pipeline.stages?.find((s: any) => s.isRevenueStage);
            const completionStage = pipeline.stages?.find((s: any) => s.isCompletionStage);
            
            if (revenueStage || completionStage) {
              existingSelections[pipeline.id] = {
                revenueStageId: revenueStage?.id,
                completionStageId: completionStage?.id
              };
            }
          });
          
          setSelectedStages(existingSelections);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('Failed to fetch pipeline data:', errorData);
        setMessage({ type: 'error', text: errorData.error || 'Failed to fetch pipeline data' });
      }
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      setMessage({ type: 'error', text: 'Error loading pipelines' });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = (pipelineId: string, stageType: 'revenue' | 'completion', stageId: string) => {
    setSelectedStages(prev => ({
      ...prev,
      [pipelineId]: {
        ...prev[pipelineId],
        [stageType === 'revenue' ? 'revenueStageId' : 'completionStageId']: stageId || undefined
      }
    }));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Prepare pipeline data with selections
      const pipelineData = pipelines.map(pipeline => ({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        stages: pipeline.stages,
        revenueStageId: selectedStages[pipeline.id]?.revenueStageId || null,
        completionStageId: selectedStages[pipeline.id]?.completionStageId || null
      }));
      
      console.log('Saving pipeline data:', pipelineData);
      
      const response = await fetch('/api/pipelines/save-manual-stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          integrationId,
          pipelines: pipelineData
        })
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Pipeline settings saved successfully!' });
        // Try to refresh, but don't fail if it doesn't work
        try {
          await fetchPipelineData();
        } catch (refreshError) {
          console.error('Error refreshing data after save:', refreshError);
          // Data was saved successfully, just couldn't refresh the display
          setMessage({ type: 'success', text: 'Settings saved! Refresh the page to see updates.' });
        }
      } else {
        console.error('Save failed:', responseData);
        setMessage({ type: 'error', text: responseData.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving pipeline settings:', error);
      setMessage({ type: 'error', text: 'Error saving settings' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pipeline Stage Configuration</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure which stages represent revenue recognition and commission points
          </p>
        </div>
        <button
          onClick={saveChanges}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 mt-0.5 ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`} />
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Color Legend */}
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

        {/* Pipeline Configuration */}
        <div className="divide-y divide-gray-200">
          {pipelines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No pipelines found. Please connect to GoHighLevel first.
            </div>
          ) : (
            pipelines.map(pipeline => {
              const currentSelection = selectedStages[pipeline.id] || {};
              const revenueStageId = currentSelection.revenueStageId;
              const completionStageId = currentSelection.completionStageId;
              
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
                        value={revenueStageId || ''}
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
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Commission Due Stage
                      </label>
                      <select
                        value={completionStageId || ''}
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
                    </div>
                  </div>
                  
                  {/* Visual Stage Preview */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pipeline.stages.map(stage => {
                      const isRevenue = stage.id === revenueStageId;
                      const isCompletion = stage.id === completionStageId;
                      const revenueStage = pipeline.stages.find(s => s.id === revenueStageId);
                      const isPostRevenue = revenueStage && stage.position >= revenueStage.position;
                      
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

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">How to Configure:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Select the <strong>Revenue Recognition Stage</strong> - the first stage where deals are confirmed/won</li>
              <li>Select the <strong>Commission Due Stage</strong> - when the work is complete and commissions should be paid</li>
              <li>Click <strong>Save Changes</strong> to apply your configuration</li>
              <li>Stages before revenue recognition will show in red, stages at/after will show in green</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}