'use client';

import Link from "next/link";
import { Plus, Zap, Search, Filter, MoreVertical, Clock, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useMockAuth } from "@/lib/auth/mock-auth";

export default function WorkflowsPage() {
  const { userId } = useMockAuth();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        console.log('Fetching workflows from API...');
        
        const response = await fetch('/api/workflows/list');
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Error fetching workflows:', data.error);
        } else {
          console.log('Fetched workflows:', data.workflows);
          setWorkflows(data.workflows || []);
        }
      } catch (error) {
        console.error('Error fetching workflows:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflows();
  }, []);
  
  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600 mt-1">Manage and monitor your automation workflows</p>
          </div>
          <Link
            href="/workflows/new"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Create Workflow</span>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>
        <button className="inline-flex items-center space-x-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-gray-700">Filter</span>
        </button>
      </div>

      {filteredWorkflows.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredWorkflows.map((workflow) => (
              <Link 
                key={workflow.id} 
                href={`/workflows/${workflow.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{workflow.name}</h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-sm text-gray-500">
                          {workflow.description || 'No description'}
                        </p>
                        <span className="text-xs text-gray-400">
                          {workflow.last_executed_at 
                            ? `Last run ${new Date(workflow.last_executed_at).toLocaleDateString()}`
                            : `Created ${new Date(workflow.created_at).toLocaleDateString()}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>{workflow.execution_count || 0} runs</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      workflow.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button 
                      onClick={(e) => e.preventDefault()}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create your first workflow to start automating your tasks. Use AI to generate workflows from natural language or build them visually.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Link
                href="/workflows/new"
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Workflow</span>
              </Link>
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                Browse Templates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}