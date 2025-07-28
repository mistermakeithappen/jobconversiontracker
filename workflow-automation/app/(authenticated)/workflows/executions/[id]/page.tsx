'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Loader2, Terminal } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ExecutionResult, WorkflowNode, WorkflowEdge } from '@/types/api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExecutionDetailPage() {
  const params = useParams();
  const executionId = params.id as string;
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [workflow, setWorkflow] = useState<{ id: string; name: string; definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!executionId) return;
    
    const loadExecutionData = async () => {
      // Load execution
      const { data: execData, error: execError } = await supabase
        .from('executions')
        .select('*')
        .eq('id', executionId)
        .single();
        
      if (execError) {
        console.error('Error loading execution:', execError);
        setLoading(false);
        return;
      }
      
      setExecution(execData);
      
      // Load workflow
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', execData.workflow_id)
        .single();
        
      if (!workflowError && workflowData) {
        setWorkflow(workflowData);
      }
      
      setLoading(false);
    };
    
    loadExecutionData();
    
    // Refresh every 2 seconds if still running
    const interval = setInterval(() => {
      if (execution?.status === 'running' || execution?.status === 'pending') {
        loadExecutionData();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [executionId, execution?.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'running':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Terminal className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Execution not found</h1>
          <Link href="/workflows/executions" className="text-blue-600 hover:underline">
            Back to executions
          </Link>
        </div>
      </div>
    );
  }

  const duration = execution.completed_at 
    ? new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()
    : Date.now() - new Date(execution.started_at).getTime();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link 
              href="/workflows/executions"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Execution Details</h1>
              {workflow && (
                <p className="text-sm text-gray-500">
                  Workflow: {workflow.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(execution.status)}
              <div>
                <h2 className="text-lg font-semibold capitalize">{execution.status}</h2>
                <p className="text-sm text-gray-500">
                  Started at {new Date(execution.started_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-semibold">{Math.round(duration / 1000)}s</p>
            </div>
          </div>
          
          {execution.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <h3 className="font-medium text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-700">{execution.error}</p>
            </div>
          )}
        </div>

        {/* Input/Output Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Input Data</h3>
            <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-auto max-h-64">
              {JSON.stringify(execution.input_data || {}, null, 2)}
            </pre>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Output Data</h3>
            <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-auto max-h-64">
              {JSON.stringify(execution.output_data || {}, null, 2)}
            </pre>
          </div>
        </div>

        {/* Execution Logs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Execution Logs</h3>
          {execution.logs && execution.logs.length > 0 ? (
            <div className="space-y-2">
              {execution.logs.map((log, index) => (
                <div 
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        Node: {log.nodeId}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{log.message}</p>
                    {log.data && (
                      <pre className="mt-2 text-xs bg-white rounded p-2 overflow-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No logs available</p>
          )}
        </div>
      </div>
    </div>
  );
}