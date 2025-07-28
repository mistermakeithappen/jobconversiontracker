import { Zap, Play, CreditCard, TrendingUp, Plus, Activity, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  // Mock auth - no need to check authentication

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
        <p className="text-gray-600 mt-1">Here&apos;s an overview of your automation platform</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">This month</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Active Workflows</h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500 mt-2">Ready to execute</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Today</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Executions</h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500 mt-2">0 successful, 0 failed</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Credits Remaining</h3>
          <p className="text-3xl font-bold text-gray-900">15,000</p>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">All time</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Success Rate</h3>
          <p className="text-3xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-2">No data yet</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Workflows</h2>
            </div>
            <Link href="/workflows/new" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Create new
            </Link>
          </div>
          
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">No workflows created yet</p>
            <Link 
              href="/workflows/new" 
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first workflow</span>
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Executions</h2>
            </div>
            <Link href="/executions" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </Link>
          </div>
          
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">No executions yet</p>
            <p className="text-sm text-gray-400">Workflow executions will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}