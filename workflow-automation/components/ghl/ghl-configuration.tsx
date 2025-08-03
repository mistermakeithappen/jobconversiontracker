'use client';

import { useState, useEffect } from 'react';
import { Building2, Key, Shield, Check, X, RefreshCw, Info } from 'lucide-react';

interface GHLConfigurationProps {
  integrationId: string;
  connected: boolean;
  locationName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function GHLConfiguration({ 
  integrationId, 
  connected, 
  locationName,
  onConnect,
  onDisconnect 
}: GHLConfigurationProps) {
  const [pitToken, setPitToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingPIT, setHasExistingPIT] = useState(false);

  useEffect(() => {
    if (connected) {
      checkPITStatus();
    }
  }, [connected]);

  const checkPITStatus = async () => {
    try {
      const response = await fetch('/api/mcp/ghl');
      const data = await response.json();
      setHasExistingPIT(data.hasStoredToken || false);
    } catch (error) {
      console.error('Error checking PIT status:', error);
    }
  };

  const handleSavePIT = async () => {
    if (!pitToken.trim()) {
      setError('Please enter a Private Integration Token');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/mcp/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpToken: pitToken.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Private Integration Token saved successfully!');
        setPitToken(''); // Clear token for security
        setHasExistingPIT(true);
      } else {
        setError(data.error || 'Failed to save Private Integration Token');
      }
    } catch (error) {
      setError('Network error: Failed to save token');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePIT = async () => {
    if (!confirm('Are you sure you want to remove your Private Integration Token? This will disable features that require PIT authentication.')) {
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
        setSuccess('Private Integration Token removed successfully');
        setHasExistingPIT(false);
      } else {
        setError('Failed to remove Private Integration Token');
      }
    } catch (error) {
      setError('Network error: Failed to remove token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth Connection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${connected ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Building2 className={`w-5 h-5 ${connected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">GoHighLevel OAuth Connection</h3>
              <p className="text-sm text-gray-600">
                {connected ? `Connected to ${locationName || 'GoHighLevel'}` : 'Connect your GoHighLevel account'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {connected ? (
              <>
                <span className="flex items-center space-x-1 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Connected</span>
                </span>
                <button
                  onClick={onDisconnect}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={onConnect}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Connect GoHighLevel
              </button>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          OAuth connection provides access to contacts, opportunities, and basic API features.
        </div>
      </div>

      {/* Private Integration Token */}
      {connected && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Private Integration Token (PIT)</h3>
                <p className="text-sm text-gray-600">
                  {hasExistingPIT ? 'Token configured' : 'Add your PIT for advanced features'}
                </p>
              </div>
            </div>
            
            {hasExistingPIT && (
              <span className="flex items-center space-x-1 text-sm text-green-600">
                <Check className="w-4 h-4" />
                <span>Configured</span>
              </span>
            )}
          </div>

          {/* PIT Benefits */}
          <div className="mb-6 space-y-2">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-green-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Enhanced Access:</span>
                <span className="text-gray-600 ml-1">Access to estimates, invoices, and advanced APIs</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-green-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">No Token Expiry:</span>
                <span className="text-gray-600 ml-1">PITs don't expire like OAuth tokens</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-green-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-gray-700">AI Features:</span>
                <span className="text-gray-600 ml-1">Enable AI-powered automation with MCP</span>
              </div>
            </div>
          </div>

          {/* Token Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Integration Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={pitToken}
                  onChange={(e) => setPitToken(e.target.value)}
                  placeholder={hasExistingPIT ? "Enter new PIT to update..." : "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
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
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSavePIT}
                disabled={loading || !pitToken.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>{hasExistingPIT ? 'Update Token' : 'Save Token'}</span>
                  </>
                )}
              </button>
              
              {hasExistingPIT && (
                <button
                  onClick={handleRemovePIT}
                  disabled={loading}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Remove Token
                </button>
              )}
            </div>
          </div>

          {/* How to get PIT */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              <strong>How to get your PIT token:</strong><br/>
              1. Go to Settings → Private Integrations in GoHighLevel<br/>
              2. Click "Create New Integration"<br/>
              3. Select required scopes (Contacts, Conversations, Opportunities, etc.)<br/>
              4. Copy the generated Private Integration Token
            </p>
          </div>

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
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Why two authentication methods?</p>
          <p>
            OAuth is required for user-specific operations and webhooks. The Private Integration Token 
            provides access to additional APIs (like estimates) and enables AI-powered features through 
            the Model Context Protocol (MCP).
          </p>
        </div>
      </div>
    </div>
  );
}