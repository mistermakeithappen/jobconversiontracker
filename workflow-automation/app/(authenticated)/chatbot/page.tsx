'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Bot, Settings, Trash2, Edit3, Play, Pause, Copy, ChevronRight, MessageSquare, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  knowledge_base?: any;
  workflows?: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
}

export default function BotDashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotData, setNewBotData] = useState({
    name: '',
    description: '',
    avatar_url: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  // Fetch bots on mount
  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/bots');
      if (!response.ok) {
        console.error('Failed to fetch bots:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      setBots(data);
    } catch (error) {
      console.error('Error fetching bots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBot = async () => {
    if (!newBotData.name.trim()) return;

    try {
      setIsCreating(true);
      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBotData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create bot:', response.status, errorData.error);
        alert(errorData.error || 'Failed to create bot');
        return;
      }
      
      const newBot = await response.json();
      setBots([...bots, newBot]);
      setShowCreateModal(false);
      setNewBotData({ name: '', description: '', avatar_url: '' });
    } catch (error) {
      console.error('Error creating bot:', error);
      alert('An error occurred while creating the bot');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      const response = await fetch(`/api/bots?botId=${botId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete bot');
      
      setBots(bots.filter(bot => bot.id !== botId));
    } catch (error) {
      console.error('Error deleting bot:', error);
    }
  };

  const handleToggleBot = async (botId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/bots?botId=${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (!response.ok) throw new Error('Failed to update bot');
      
      setBots(bots.map(bot => 
        bot.id === botId ? { ...bot, is_active: !isActive } : bot
      ));
    } catch (error) {
      console.error('Error updating bot:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBotAvatar = (bot: Bot) => {
    if (bot.avatar_url) {
      return (
        <img 
          src={bot.avatar_url} 
          alt={bot.name} 
          className="w-12 h-12 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
        <Bot className="w-6 h-6 text-white" />
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Bot Management</h1>
          <p className="text-gray-600">Create and manage your AI-powered workflow bots</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Bot
          </button>
        </div>
      </div>

      {/* Bots Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading bots...</p>
          </div>
        </div>
      ) : bots.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No bots created yet</h3>
            <p className="text-gray-600 mb-6">Create your first bot to start building AI-powered workflows</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Your First Bot
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {getBotAvatar(bot)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{bot.name}</h3>
                      <p className="text-sm text-gray-600">
                        {bot.is_active ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500">
                            <span className="w-2 h-2 bg-gray-400 rounded-full" />
                            Inactive
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleBot(bot.id, bot.is_active)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {bot.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {bot.description || 'No description provided'}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>Created {formatDate(bot.created_at)}</span>
                  {bot.workflows && bot.workflows.length > 0 && (
                    <span>{bot.workflows.length} workflow{bot.workflows.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Link
                    href={`/chatbot/${bot.id}/workflow`}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors text-center"
                  >
                    Edit Workflow
                  </Link>
                  <Link
                    href={`/chatbot/${bot.id}/settings`}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Bot Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteBot(bot.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Bot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Bot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New Bot</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={newBotData.name}
                  onChange={(e) => setNewBotData({ ...newBotData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  placeholder="e.g., Customer Support Bot"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newBotData.description}
                  onChange={(e) => setNewBotData({ ...newBotData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  rows={3}
                  placeholder="Describe what this bot does..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  value={newBotData.avatar_url}
                  onChange={(e) => setNewBotData({ ...newBotData, avatar_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateBot}
                disabled={isCreating || !newBotData.name.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Bot
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBotData({ name: '', description: '', avatar_url: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/chatbot/test-mcp"
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all group"
          >
            <Settings className="w-8 h-8 text-purple-600 mb-2" />
            <h4 className="font-medium text-gray-800 group-hover:text-purple-600">Test MCP Integration</h4>
            <p className="text-sm text-gray-600 mt-1">Verify GoHighLevel MCP connection</p>
          </Link>
          
          <Link
            href="/chatbot/templates"
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all group"
          >
            <Copy className="w-8 h-8 text-purple-600 mb-2" />
            <h4 className="font-medium text-gray-800 group-hover:text-purple-600">Bot Templates</h4>
            <p className="text-sm text-gray-600 mt-1">Start with pre-built workflows</p>
          </Link>
          
          <Link
            href="/chatbot/analytics"
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all group"
          >
            <ChevronRight className="w-8 h-8 text-purple-600 mb-2" />
            <h4 className="font-medium text-gray-800 group-hover:text-purple-600">Analytics</h4>
            <p className="text-sm text-gray-600 mt-1">View bot performance metrics</p>
          </Link>
        </div>
      </div>
    </div>
  );
}