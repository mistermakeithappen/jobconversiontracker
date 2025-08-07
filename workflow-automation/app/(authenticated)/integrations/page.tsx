'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, FileText, Database, Globe, MessageSquare, Calendar, ChevronRight, CheckCircle, Plus, Key, Eye, EyeOff, Edit, Trash2, Check, X, AlertCircle, ExternalLink, Info } from 'lucide-react';
import { GHLConfiguration } from '@/components/ghl/ghl-configuration';

interface UserApiKey {
  id: string;
  provider: string;
  keyName?: string;
  maskedKey?: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

const integrations = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'All-in-one workspace for notes and databases',
    icon: FileText,
    color: 'bg-gray-100 text-gray-600',
    connected: false,
    available: false,
    href: '/integrations/notion'
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Spreadsheet-database hybrid',
    icon: Database,
    color: 'bg-blue-100 text-blue-600',
    connected: false,
    available: false,
    href: '/integrations/airtable'
  },
  {
    id: 'browseai',
    name: 'Browse AI',
    description: 'Web scraping and data extraction',
    icon: Globe,
    color: 'bg-purple-100 text-purple-600',
    connected: false,
    available: false,
    href: '/integrations/browseai'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI models for text generation and analysis',
    icon: MessageSquare,
    color: 'bg-green-100 text-green-600',
    connected: false,
    available: false,
    href: '/integrations/openai'
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Scheduling and appointment booking',
    icon: Calendar,
    color: 'bg-indigo-100 text-indigo-600',
    connected: false,
    available: false,
    href: '/integrations/calendly'
  }
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('integrations');
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'openai',
    apiKey: '',
    keyName: ''
  });
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghlIntegration, setGhlIntegration] = useState<any>(null);
  const [ghlLoading, setGhlLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'api-keys') {
      fetchApiKeys();
    } else if (activeTab === 'gohighlevel') {
      fetchGhlIntegrationStatus();
    }
  }, [activeTab]);

  const fetchGhlIntegrationStatus = async () => {
    try {
      setGhlLoading(true);
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      
      if (response.ok) {
        setGhlIntegration({
          id: data.integration?.id || 'ghl-integration',
          connected: data.connected,
          locationName: data.integration?.config?.locationName || 'Connected Account',
          needsReconnection: data.needsReconnection,
          reconnectionReason: data.reconnectionReason
        });
      } else {
        setGhlIntegration({
          id: 'ghl-integration',
          connected: false
        });
      }
    } catch (error) {
      console.error('Error fetching integration status:', error);
      setGhlIntegration({
        id: 'ghl-integration',
        connected: false
      });
    } finally {
      setGhlLoading(false);
    }
  };

  const handleGhlConnect = async () => {
    try {
      const response = await fetch('/api/integrations/automake/connect');
      const data = await response.json();

      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert(data.error || 'Failed to initiate connection to GoHighLevel');
      }
    } catch (error) {
      console.error('Error connecting to GHL:', error);
      alert('Error connecting to GoHighLevel');
    }
  };

  const handleGhlDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from GoHighLevel?')) {
      return;
    }

    try {
      const response = await fetch('/api/integrations/automake/disconnect', {
        method: 'POST'
      });

      if (response.ok) {
        window.location.reload();
      } else {
        alert('Failed to disconnect from GoHighLevel');
      }
    } catch (error) {
      console.error('Error disconnecting from GHL:', error);
      alert('Error disconnecting from GoHighLevel');
    }
  };

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/api-keys');
      const data = await response.json();
      
      if (response.ok) {
        setApiKeys(data.apiKeys);
      } else {
        setError(data.error || 'Failed to fetch API keys');
      }
    } catch (error) {
      setError('Failed to fetch API keys');
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        await fetchApiKeys();
        setShowAddForm(false);
        setFormData({ provider: 'openai', apiKey: '', keyName: '' });
      } else {
        // Show detailed error message for specific cases
        if (data.details) {
          setError(`${data.error}: ${data.details}`);
        } else {
          setError(data.error || 'Failed to add API key');
        }
      }
    } catch (error) {
      setError('Failed to add API key');
      console.error('Error adding API key:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchApiKeys();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      setError('Failed to delete API key');
      console.error('Error deleting API key:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'bg-green-100 text-green-800';
      case 'anthropic': return 'bg-blue-100 text-blue-800';
      case 'google': return 'bg-yellow-100 text-yellow-800';
      case 'azure': return 'bg-purple-100 text-purple-800';
      case 'notion': return 'bg-gray-100 text-gray-800';
      case 'ghlpit': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'openai':
        return {
          name: 'OpenAI',
          description: 'Used for receipt processing with GPT-4 Vision',
          linkText: 'Get OpenAI API Key',
          link: 'https://platform.openai.com/api-keys',
          placeholder: 'sk-proj-...'
        };
      case 'notion':
        return {
          name: 'Notion',
          description: 'Used for database and page integrations',
          linkText: 'Create Notion Integration',
          link: 'https://www.notion.so/my-integrations',
          placeholder: 'secret_...'
        };
      case 'anthropic':
        return {
          name: 'Anthropic',
          description: 'Used for Claude AI features',
          linkText: 'Get Anthropic API Key',
          link: 'https://console.anthropic.com/',
          placeholder: 'sk-ant-...'
        };
      case 'google':
        return {
          name: 'Google AI',
          description: 'Used for Gemini and other Google AI features',
          linkText: 'Get Google AI API Key',
          link: 'https://aistudio.google.com/app/apikey',
          placeholder: 'AIza...'
        };
      case 'azure':
        return {
          name: 'Azure OpenAI',
          description: 'Used for Azure OpenAI Service',
          linkText: 'Get Azure OpenAI Key',
          link: 'https://portal.azure.com/',
          placeholder: 'your-azure-key'
        };
      case 'ghlpit':
        return {
          name: 'GoHighLevel Private Integration',
          description: 'Used for advanced GoHighLevel features like estimates and AI-powered automation',
          linkText: 'Create Private Integration',
          link: 'https://app.gohighlevel.com/settings/private-integrations',
          placeholder: 'pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        };
      default:
        return {
          name: provider,
          description: '',
          linkText: '',
          link: '',
          placeholder: ''
        };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations & API Keys</h1>
        <p className="text-gray-600 mt-1">Connect your favorite tools and manage API keys for AI services</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'integrations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>Third-party Integrations</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('gohighlevel')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'gohighlevel'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>GoHighLevel</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'api-keys'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4" />
              <span>API Keys</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'gohighlevel' ? (
        <div className="space-y-6">
          {/* Reconnection Alert */}
          {ghlIntegration?.needsReconnection && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Reconnection Required</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    {ghlIntegration?.reconnectionReason || 'Your GoHighLevel connection needs to be re-authorized. Please reconnect to continue using all features.'}
                  </p>
                  <button
                    onClick={handleGhlConnect}
                    className="mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Reconnect Now →
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">GoHighLevel Configuration</h3>
            <p className="text-gray-600 mb-6">Manage your GoHighLevel connection and authentication tokens</p>
            
            {ghlLoading ? (
              <div className="animate-pulse h-64 bg-gray-200 rounded-lg"></div>
            ) : ghlIntegration ? (
              <GHLConfiguration
                integrationId={ghlIntegration.id}
                connected={ghlIntegration.connected}
                locationName={ghlIntegration.locationName}
                onConnect={handleGhlConnect}
                onDisconnect={handleGhlDisconnect}
              />
            ) : null}
          </div>
        </div>
      ) : activeTab === 'integrations' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <Link
                  key={integration.id}
                  href={integration.available ? integration.href : '#'}
                  className={`
                    bg-white rounded-xl border border-gray-200 p-6 transition-all duration-200
                    ${integration.available 
                      ? 'hover:shadow-lg hover:border-blue-200 cursor-pointer' 
                      : 'opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${integration.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {integration.connected ? (
                      <span className="flex items-center space-x-1 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Connected</span>
                      </span>
                    ) : integration.available ? (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Coming Soon</span>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1">{integration.name}</h3>
                  <p className="text-sm text-gray-600">{integration.description}</p>
                  
                  {integration.available && !integration.connected && (
                    <button className="mt-4 inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus className="w-4 h-4" />
                      <span>Connect</span>
                    </button>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request an Integration</h2>
            <p className="text-gray-600 mb-4">
              Don&apos;t see the integration you need? Let us know what tools you&apos;d like to connect.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Request Integration
            </button>
          </div>
        </>
      ) : (
        /* API Keys Tab Content */
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Add API Key Button */}
          <div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add API Key</span>
            </button>
          </div>

          {/* Add API Key Form */}
          {showAddForm && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Add New API Key</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddApiKey} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="notion">Notion</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google AI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="ghlpit">GoHighLevel Private Integration</option>
                  </select>
                  
                  {/* Provider Info */}
                  {formData.provider && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Info className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                              {getProviderInfo(formData.provider).name}
                            </span>
                          </div>
                          <p className="text-sm text-blue-700 mt-1">
                            {getProviderInfo(formData.provider).description}
                          </p>
                        </div>
                        {getProviderInfo(formData.provider).link && (
                          <a
                            href={getProviderInfo(formData.provider).link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <span>{getProviderInfo(formData.provider).linkText}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder={getProviderInfo(formData.provider).placeholder || "Enter your API key..."}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Key Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.keyName}
                    onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
                    placeholder="Production Key, Testing Key, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={validating}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {validating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Add Key</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* API Keys List */}
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
                  <p className="text-gray-600 mb-4">
                    Add your first API key to enable AI-powered features
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add API Key</span>
                  </button>
                </div>
              ) : (
                apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Key className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(apiKey.provider)}`}>
                              {apiKey.provider.toUpperCase()}
                            </span>
                            {apiKey.keyName && (
                              <span className="text-lg font-medium text-gray-900">
                                {apiKey.keyName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 font-mono">
                            {apiKey.maskedKey || '••••••••••••••••••••••••••••••••'}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            <span>Added {formatDate(apiKey.createdAt)}</span>
                            {apiKey.lastUsedAt && (
                              <span>Last used {formatDate(apiKey.lastUsedAt)}</span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              apiKey.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {apiKey.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">About API Keys</h3>
                <p className="text-blue-700 text-sm mt-1">
                  Your API keys are encrypted and stored securely. They&apos;re only used for AI features like receipt processing. 
                  You can add multiple keys per provider for different purposes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}