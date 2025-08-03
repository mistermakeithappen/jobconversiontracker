'use client';

import { useState, useEffect } from 'react';
import { Brain, Check, X, RefreshCw, Info, Shield, Zap } from 'lucide-react';

interface MCPCapabilities {
  tools: Array<{ name: string; description?: string }>;
  resources: Array<{ uri: string; name: string; description?: string }>;
  prompts: Array<{ name: string; description?: string }>;
  lastUpdated: string;
}

interface MCPSettingsProps {
  integrationId: string;
  onStatusChange?: (enabled: boolean) => void;
}

export function MCPSettings({ integrationId, onStatusChange }: MCPSettingsProps) {
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpToken, setMcpToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [capabilities, setCapabilities] = useState<MCPCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  useEffect(() => {
    checkMCPStatus();
  }, []);

  const checkMCPStatus = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/mcp/ghl');
      const data = await response.json();
      
      setMcpEnabled(data.mcpEnabled || false);
      // Check if there's a stored token (regardless of whether it's working)
      setHasExistingToken(data.hasStoredToken || false);
      
      if (data.capabilities) {
        setCapabilities(data.capabilities);
      }
      
      if (onStatusChange) {
        onStatusChange(data.mcpEnabled || false);
      }
    } catch (error) {
      console.error('Error checking MCP status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleEnableMCP = async () => {
    if (!mcpToken.trim()) {
      setError('Please enter an MCP token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/mcp/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpToken: mcpToken.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'MCP enabled successfully!');
        setMcpEnabled(true);
        setMcpToken(''); // Clear token for security
        await checkMCPStatus(); // Refresh capabilities
        
        if (onStatusChange) {
          onStatusChange(true);
        }
      } else {
        setError(data.error || 'Failed to enable MCP');
      }
    } catch (error) {
      setError('Network error: Failed to enable MCP');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMCP = async () => {
    if (!confirm('Are you sure you want to disable MCP? This will remove enhanced AI capabilities.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/mcp/ghl', {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess('MCP disabled successfully');
        setMcpEnabled(false);
        setCapabilities(null);
        
        if (onStatusChange) {
          onStatusChange(false);
        }
      } else {
        setError('Failed to disable MCP');
      }
    } catch (error) {
      setError('Network error: Failed to disable MCP');
    } finally {
      setLoading(false);
    }
  };

  const formatCapabilityName = (name: string) => {
    return name
      .replace(/^ghl_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* MCP Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${mcpEnabled ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <Brain className={`w-5 h-5 ${mcpEnabled ? 'text-purple-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Model Context Protocol (MCP)</h3>
              <p className="text-sm text-gray-600">
                {mcpEnabled ? 'Enhanced AI capabilities enabled' : 'Enable MCP for advanced AI features'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {mcpEnabled ? (
              <>
                <span className="flex items-center space-x-1 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Connected</span>
                </span>
                <button
                  onClick={handleDisableMCP}
                  disabled={loading}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Disable
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-500">Disconnected</span>
            )}
          </div>
        </div>

        {/* MCP Benefits */}
        {!mcpEnabled && (
          <div className="mb-6 space-y-2">
            <div className="flex items-start space-x-2">
              <Zap className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Faster Operations:</span>
                <span className="text-gray-600 ml-1">Direct AI-optimized API access</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Brain className="w-4 h-4 text-purple-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Smart Context:</span>
                <span className="text-gray-600 ml-1">AI understands your GHL data structure</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-green-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Secure:</span>
                <span className="text-gray-600 ml-1">Token-based authentication with encrypted storage</span>
              </div>
            </div>
          </div>
        )}

        {/* Token Input */}
        {!mcpEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Integration Token (PIT)
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={mcpToken}
                  onChange={(e) => setMcpToken(e.target.value)}
                  placeholder={hasExistingToken ? "Enter new Private Integration Token (PIT) to update..." : "Enter your Private Integration Token (PIT)..."}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your Private Integration Token will be encrypted and stored securely
              </p>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800">
                  <strong>How to get your PIT token:</strong><br/>
                  1. Go to Settings → Private Integrations in GoHighLevel<br/>
                  2. Click "Create New Integration"<br/>
                  3. Select required scopes (Contacts, Conversations, Opportunities, etc.)<br/>
                  4. Copy the generated Private Integration Token
                </p>
              </div>
            </div>

            <button
              onClick={handleEnableMCP}
              disabled={loading || !mcpToken.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>{hasExistingToken ? 'Update & Enable MCP' : 'Save & Enable MCP'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start space-x-2">
            <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-start space-x-2">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* Capabilities */}
      {mcpEnabled && capabilities && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Available Capabilities</h3>
            <button
              onClick={checkMCPStatus}
              disabled={checking}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {checking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="space-y-4">
            {/* Tools */}
            {capabilities.tools.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Tools ({capabilities.tools.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {capabilities.tools.slice(0, 9).map((tool, index) => (
                    <div
                      key={index}
                      className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
                      title={tool.description}
                    >
                      {formatCapabilityName(tool.name)}
                    </div>
                  ))}
                  {capabilities.tools.length > 9 && (
                    <div className="text-xs text-gray-500">
                      +{capabilities.tools.length - 9} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resources */}
            {capabilities.resources.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Resources ({capabilities.resources.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {capabilities.resources.slice(0, 6).map((resource, index) => (
                    <div
                      key={index}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded truncate"
                      title={resource.description || resource.uri}
                    >
                      {resource.name || resource.uri}
                    </div>
                  ))}
                  {capabilities.resources.length > 6 && (
                    <div className="text-xs text-gray-500">
                      +{capabilities.resources.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompts */}
            {capabilities.prompts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Prompts ({capabilities.prompts.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {capabilities.prompts.slice(0, 6).map((prompt, index) => (
                    <div
                      key={index}
                      className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded"
                      title={prompt.description}
                    >
                      {formatCapabilityName(prompt.name)}
                    </div>
                  ))}
                  {capabilities.prompts.length > 6 && (
                    <div className="text-xs text-gray-500">
                      +{capabilities.prompts.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(capabilities.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">What is MCP?</p>
          <p>
            The Model Context Protocol enables AI assistants to directly interact with GoHighLevel
            through optimized tools and resources, providing faster and more intelligent automation
            capabilities.
          </p>
        </div>
      </div>
    </div>
  );
}