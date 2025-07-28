'use client';

import { useState, useEffect } from 'react';
import { Search, Code, BookOpen, Zap, Database, MessageSquare, Building2, Key, Copy, CheckCircle, ExternalLink, Filter, Download } from 'lucide-react';
import { Integration, ApiEndpoint } from '@/lib/integrations/registry';

interface EndpointWithIntegration extends ApiEndpoint {
  integrationId: string;
  integrationName: string;
}

export default function DeveloperDocsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [allEndpoints, setAllEndpoints] = useState<EndpointWithIntegration[]>([]);
  const [filteredEndpoints, setFilteredEndpoints] = useState<EndpointWithIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchIntegrations();
    fetchAllEndpoints();
  }, []);

  useEffect(() => {
    filterEndpoints();
  }, [allEndpoints, searchTerm, selectedCategory, selectedMethod]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations/registry');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEndpoints = async () => {
    try {
      const response = await fetch('/api/integrations/registry?endpoints=true');
      const data = await response.json();
      setAllEndpoints(data.endpoints || []);
    } catch (error) {
      console.error('Error fetching endpoints:', error);
    }
  };

  const filterEndpoints = () => {
    let filtered = allEndpoints;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(endpoint =>
        endpoint.path.toLowerCase().includes(lowerSearch) ||
        endpoint.description.toLowerCase().includes(lowerSearch) ||
        endpoint.integrationName.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedCategory !== 'all') {
      const integration = integrations.find(i => i.category === selectedCategory);
      if (integration) {
        filtered = filtered.filter(endpoint => endpoint.integrationId === integration.id);
      }
    }

    if (selectedMethod !== 'all') {
      filtered = filtered.filter(endpoint => endpoint.method === selectedMethod);
    }

    setFilteredEndpoints(filtered);
  };

  const copyToClipboard = async (text: string, path: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-800';
      case 'POST': return 'bg-blue-100 text-blue-800';
      case 'PUT': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'PATCH': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'CRM': return Building2;
      case 'AI': return MessageSquare;
      case 'Database': return Database;
      case 'Analytics': return Zap;
      default: return Code;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'beta': return 'bg-yellow-100 text-yellow-800';
      case 'deprecated': return 'bg-red-100 text-red-800';
      case 'planned': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportOpenApi = () => {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'FlowAI Platform API',
        description: 'Comprehensive API documentation for the FlowAI automation platform',
        version: '1.0.0',
        contact: {
          name: 'FlowAI Support',
          url: 'https://flowai.com/support'
        }
      },
      servers: [
        {
          url: window.location.origin,
          description: 'FlowAI Platform'
        }
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer'
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      }
    };

    // Convert endpoints to OpenAPI format
    allEndpoints.forEach(endpoint => {
      if (!openApiSpec.paths[endpoint.path]) {
        openApiSpec.paths[endpoint.path] = {};
      }

      openApiSpec.paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.description,
        tags: [endpoint.integrationName],
        parameters: endpoint.parameters?.map(param => ({
          name: param.name,
          in: param.name === 'id' ? 'path' : 'query',
          required: param.required,
          description: param.description,
          schema: {
            type: param.type,
            example: param.example
          }
        })),
        responses: endpoint.responses?.reduce((acc, response) => {
          acc[response.status] = {
            description: response.description,
            content: response.example ? {
              'application/json': {
                example: response.example
              }
            } : undefined
          };
          return acc;
        }, {} as any) || {
          '200': {
            description: 'Success'
          }
        },
        security: endpoint.authentication ? [{ bearerAuth: [] }] : undefined
      };
    });

    const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowai-api-spec.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const categories = [...new Set(integrations.map(i => i.category))];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Developer Documentation</h1>
        <p className="text-gray-600 mt-2">
          Complete API reference for all platform integrations and endpoints
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Overview</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'endpoints'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4" />
              <span>API Reference</span>
            </div>
          </button>
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
              <span>Integrations</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Integrations</p>
                  <p className="text-2xl font-bold text-gray-900">{integrations.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">API Endpoints</p>
                  <p className="text-2xl font-bold text-gray-900">{allEndpoints.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{integrations.filter(i => i.status === 'active').length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Getting Started</h3>
            <div className="prose max-w-none">
              <p className="text-gray-600 mb-4">
                Welcome to the FlowAI Platform API documentation. Our platform provides comprehensive automation 
                capabilities through a RESTful API that integrates with popular business tools and AI services.
              </p>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Authentication</h4>
              <p className="text-gray-600 mb-4">
                Most endpoints require authentication. Set up your API keys in the{' '}
                <a href="/integrations" className="text-blue-600 hover:underline">Integrations</a> section.
              </p>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Base URL</h4>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm mb-4">
                {window.location.origin}
              </div>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Response Format</h4>
              <p className="text-gray-600 mb-4">
                All API responses are returned in JSON format with appropriate HTTP status codes.
              </p>
            </div>
          </div>

          {/* Integration Categories */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Integration Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const Icon = getCategoryIcon(category);
                const categoryIntegrations = integrations.filter(i => i.category === category);
                
                return (
                  <div key={category} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <h4 className="font-medium text-gray-900">{category}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {categoryIntegrations.length} integration{categoryIntegrations.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {categoryIntegrations.slice(0, 3).map((integration) => (
                        <div key={integration.id} className="text-xs text-gray-500">
                          • {integration.name}
                        </div>
                      ))}
                      {categoryIntegrations.length > 3 && (
                        <div className="text-xs text-gray-500">
                          • and {categoryIntegrations.length - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* API Reference Tab */}
      {activeTab === 'endpoints' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Endpoints ({filteredEndpoints.length})</h3>
              <button
                onClick={exportOpenApi}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export OpenAPI</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Methods</option>
                {methods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              
              <div className="text-sm text-gray-500 flex items-center">
                {filteredEndpoints.length} of {allEndpoints.length} endpoints
              </div>
            </div>
          </div>

          {/* Endpoints List */}
          <div className="space-y-6">
            {filteredEndpoints.map((endpoint, index) => (
              <div key={`${endpoint.integrationId}-${endpoint.path}-${endpoint.method}-${index}`} className="bg-white rounded-xl border border-gray-200 p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-mono font-medium ${getMethodColor(endpoint.method)}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-base font-mono text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md">
                      {endpoint.path}
                    </code>
                    <button
                      onClick={() => copyToClipboard(endpoint.path, endpoint.path)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy path"
                    >
                      {copiedPath === endpoint.path ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md">
                    {endpoint.integrationName}
                  </span>
                </div>
                
                <p className="text-base text-gray-700 mb-6 leading-relaxed">{endpoint.description}</p>
                
                {endpoint.authentication && (
                  <div className="mb-6">
                    <span className="inline-flex items-center space-x-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-md">
                      <Key className="w-4 h-4" />
                      <span>{endpoint.authentication}</span>
                    </span>
                  </div>
                )}
                
                {endpoint.parameters && endpoint.parameters.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Parameters</h4>
                    <div className="space-y-3">
                      {endpoint.parameters.map((param, paramIndex) => (
                        <div key={paramIndex} className="flex items-center space-x-4 text-sm bg-gray-50 p-3 rounded-lg">
                          <code className="font-mono text-blue-600 text-sm font-medium">{param.name}</code>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${param.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {param.type}
                          </span>
                          {param.required && (
                            <span className="text-red-500 text-xs font-medium">required</span>
                          )}
                          <span className="text-gray-600 flex-1">{param.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {endpoint.responses && endpoint.responses.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Responses</h4>
                    <div className="space-y-3">
                      {endpoint.responses.map((response, responseIndex) => (
                        <div key={responseIndex} className="text-sm bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-3 py-1 rounded-md text-sm font-mono font-medium ${
                              response.status < 300 ? 'bg-green-100 text-green-700' : 
                              response.status < 400 ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-red-100 text-red-700'
                            }`}>
                              {response.status}
                            </span>
                            <span className="text-gray-700 text-sm">{response.description}</span>
                          </div>
                          {response.example && (
                            <pre className="mt-2 bg-gray-50 rounded p-3 text-xs overflow-auto">
                              {JSON.stringify(response.example, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredEndpoints.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No endpoints found</h3>
              <p className="text-gray-600">
                Try adjusting your search terms or filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => {
              const Icon = getCategoryIcon(integration.category);
              
              return (
                <div
                  key={integration.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedIntegration(integration)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                        <p className="text-xs text-gray-500">{integration.category}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                      {integration.status}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{integration.endpoints.length} endpoints</span>
                    {integration.website && (
                      <a
                        href={integration.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Website</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Integration Detail Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    {React.createElement(getCategoryIcon(selectedIntegration.category), {
                      className: "w-6 h-6 text-blue-600"
                    })}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedIntegration.name}</h2>
                    <p className="text-sm text-gray-500">{selectedIntegration.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ExternalLink className="w-5 h-5 transform rotate-45" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-gray-700">{selectedIntegration.description}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Status</h4>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedIntegration.status)}`}>
                    {selectedIntegration.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Authentication</h4>
                  <span className="text-sm text-gray-600">{selectedIntegration.authType || 'None'}</span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Endpoints ({selectedIntegration.endpoints.length})</h4>
                <div className="space-y-2">
                  {selectedIntegration.endpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-mono font-medium ${getMethodColor(endpoint.method)}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-gray-900 flex-1">{endpoint.path}</code>
                      <span className="text-xs text-gray-500">{endpoint.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}