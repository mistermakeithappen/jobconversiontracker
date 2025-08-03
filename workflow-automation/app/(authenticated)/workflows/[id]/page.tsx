'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Save, Play, Settings, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/auth/auth-context';
import { WorkflowNode, WorkflowEdge, ExecutionResult } from '@/types/api';

// Dynamic import to avoid SSR issues with React Flow
const WorkflowBuilder = dynamic(
  () => import('@/components/workflow-builder/WorkflowBuilder'),
  { ssr: false }
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditWorkflowPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const [workflow, setWorkflow] = useState<{ id: string; name: string; definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }; status: string } | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [currentNodes, setCurrentNodes] = useState<WorkflowNode[]>([]);
  const [currentEdges, setCurrentEdges] = useState<WorkflowEdge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionResult | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<ExecutionResult[]>([]);
  const { } = useAuth(); // Auth context available but userId not needed here

  // Load workflow data
  useEffect(() => {
    if (!workflowId) return;
    
    const loadWorkflow = async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();
        
      if (error) {
        console.error('Error loading workflow:', error);
        return;
      }
      
      setWorkflow(data);
      setWorkflowName(data.name);
      setCurrentNodes(data.definition.nodes || []);
      setCurrentEdges(data.definition.edges || []);
    };
    
    loadWorkflow();
    loadRecentExecutions();
  }, [workflowId]);

  const loadRecentExecutions = async () => {
    const { data, error } = await supabase
      .from('executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('started_at', { ascending: false })
      .limit(5);
      
    if (!error && data) {
      setRecentExecutions(data);
    }
  };

  const handleSaveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          definition: {
            nodes: currentNodes,
            edges: currentEdges,
            variables: workflow?.definition?.variables || []
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Show success message
        setExecutionStatus({
          type: 'success',
          message: 'Workflow saved successfully!'
        });
        setTimeout(() => setExecutionStatus(null), 3000);
      } else {
        alert('Failed to save workflow. Please try again.');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [workflowName, currentNodes, currentEdges, workflowId, workflow]);

  const handleExecuteWorkflow = useCallback(async () => {
    setIsExecuting(true);
    setExecutionStatus(null);
    
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData: {} // Could add input data UI later
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setExecutionStatus({
          type: 'info',
          message: 'Workflow execution started...',
          executionId: data.executionId
        });
        
        // Poll for execution status
        pollExecutionStatus(data.executionId);
      } else {
        setExecutionStatus({
          type: 'error',
          message: data.error || 'Failed to execute workflow'
        });
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      setExecutionStatus({
        type: 'error',
        message: 'An error occurred while executing the workflow'
      });
    } finally {
      setIsExecuting(false);
    }
  }, [workflowId]);

  const pollExecutionStatus = async (executionId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    const checkStatus = async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/executions/${executionId}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
          setExecutionStatus({
            type: 'success',
            message: 'Workflow executed successfully!',
            executionId,
            logs: data.logs
          });
          loadRecentExecutions(); // Refresh the list
        } else if (data.status === 'failed') {
          setExecutionStatus({
            type: 'error',
            message: data.error || 'Workflow execution failed',
            executionId,
            logs: data.logs
          });
          loadRecentExecutions();
        } else if (attempts < maxAttempts) {
          // Still running, check again
          setTimeout(checkStatus, 1000);
        } else {
          setExecutionStatus({
            type: 'warning',
            message: 'Workflow execution is taking longer than expected',
            executionId
          });
        }
      } catch (error) {
        console.error('Error checking execution status:', error);
      }
    };
    
    checkStatus();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-full mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link 
              href="/workflows" 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Untitled Workflow"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-lg font-medium px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px] text-gray-900 placeholder-gray-500"
              />
              <span className={`text-sm ${workflow.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                {workflow.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleExecuteWorkflow}
              disabled={isExecuting}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute</span>
                </>
              )}
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <button 
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Execution Status */}
      {executionStatus && (
        <div className={`mx-4 mt-4 p-4 rounded-lg ${
          executionStatus.type === 'success' ? 'bg-green-50 text-green-800' :
          executionStatus.type === 'error' ? 'bg-red-50 text-red-800' :
          executionStatus.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {executionStatus.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {executionStatus.type === 'error' && <XCircle className="w-5 h-5" />}
              {executionStatus.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {executionStatus.type === 'info' && <Loader2 className="w-5 h-5 animate-spin" />}
              <span className="font-medium">{executionStatus.message}</span>
            </div>
            {executionStatus.executionId && (
              <Link 
                href={`/executions/${executionStatus.executionId}`}
                className="text-sm underline hover:no-underline"
              >
                View Details
              </Link>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <WorkflowBuilder 
            initialData={{
              nodes: currentNodes,
              edges: currentEdges
            }} 
            onNodesChange={setCurrentNodes}
            onEdgesChange={setCurrentEdges}
          />
        </div>
        
        {/* Recent Executions Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Executions</h3>
          {recentExecutions.length === 0 ? (
            <p className="text-sm text-gray-500">No executions yet</p>
          ) : (
            <div className="space-y-3">
              {recentExecutions.map((execution) => (
                <div 
                  key={execution.id}
                  className="bg-gray-50 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(execution.status)}
                      <span className="text-sm font-medium capitalize">{execution.status}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(execution.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {execution.error && (
                    <p className="text-xs text-red-600 truncate">{execution.error}</p>
                  )}
                  <Link
                    href={`/executions/${execution.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View logs →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}