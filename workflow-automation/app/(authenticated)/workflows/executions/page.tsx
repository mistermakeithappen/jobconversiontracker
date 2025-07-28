'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Loader2, Search, ExternalLink } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useMockAuth } from '@/lib/auth/mock-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Execution {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error?: string;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  workflow?: {
    id: string;
    name: string;
  };
}

export default function ExecutionsPage() {
  const { } = useMockAuth(); // Auth context available
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const { data: execData, error: execError } = await supabase
        .from('executions')
        .select(`
          *,
          workflow:workflows(id, name)
        `)
        .order('started_at', { ascending: false })
        .limit(50);

      if (execError) {
        console.error('Error fetching executions:', execError);
      } else {
        setExecutions(execData || []);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const duration = end - start;
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.workflow?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         execution.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || execution.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading executions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Executions</h1>
            <p className="text-gray-600 mt-1">Monitor and track workflow execution history</p>
          </div>
          <button
            onClick={fetchExecutions}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by workflow name or execution ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Executions List */}
      {filteredExecutions.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredExecutions.map((execution) => (
              <Link
                key={execution.id}
                href={`/workflows/executions/${execution.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(execution.status)}
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-gray-900">
                        {execution.workflow?.name || 'Unknown Workflow'}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-sm text-gray-500 font-mono">
                          {execution.id.slice(0, 8)}...
                        </p>
                        <span className="text-xs text-gray-400">
                          Started {new Date(execution.started_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="text-sm font-medium">
                        {formatDuration(execution.started_at, execution.completed_at)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(execution.status)}`}>
                      {execution.status}
                    </span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                {execution.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">Error:</p>
                    <p className="text-sm text-red-600">{execution.error}</p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {executions.length === 0 ? 'No executions yet' : 'No executions match your filter'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {executions.length === 0 
                ? 'Workflow executions will appear here once you start running your workflows.'
                : 'Try adjusting your search terms or filters to find what you\'re looking for.'
              }
            </p>
            {executions.length === 0 && (
              <Link
                href="/workflows"
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>View Workflows</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {executions.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-semibold">{executions.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-lg font-semibold">
                  {executions.filter(e => e.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-lg font-semibold">
                  {executions.filter(e => e.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Running</p>
                <p className="text-lg font-semibold">
                  {executions.filter(e => e.status === 'running' || e.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}