'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, MessageCircle, Settings, Code, Sparkles, TestTube, Workflow, Volume2, Hash, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

export default function ChatbotPage() {
  const [activeTab, setActiveTab] = useState<'test' | 'workflows' | 'settings'>('test');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to the GoHighLevel MCP Chatbot Development Environment! 🚀\n\nI\'m connected to your GoHighLevel account through MCP and ready to help you build chatbot features step by step.\n\nWhat would you like to work on first?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<any[]>([]);
  const [testProgress, setTestProgress] = useState<{[key: string]: 'pending' | 'running' | 'success' | 'error'}>({});
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: 'Thinking...',
      timestamp: new Date(),
      loading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      console.log('🚀 FRONTEND: About to send request to /api/chatbot/chat');
      console.log('📤 FRONTEND: Message being sent:', inputMessage);
      
      // Build conversation history from existing messages
      const conversationHistory = messages
        .filter(msg => msg.type !== 'system' && !msg.loading)
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: inputMessage,
          conversationHistory 
        })
      });

      console.log('📥 FRONTEND: Response status:', response.status);
      console.log('📥 FRONTEND: Response ok:', response.ok);
      
      const data = await response.json();
      console.log('📦 FRONTEND: Response data:', data);

      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.loading);
        return [...filtered, {
          id: (Date.now() + 2).toString(),
          type: 'bot',
          content: data.response || 'I\'m sorry, I encountered an error. Let me try to help you in a different way.',
          timestamp: new Date()
        }];
      });

    } catch (error) {
      console.error('Chat error:', error);
      
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.loading);
        return [...filtered, {
          id: (Date.now() + 2).toString(),
          type: 'bot',
          content: 'I\'m having trouble connecting right now. Let me help you get started with some common chatbot features:\n\n1. **Contact Management**: Search and manage GHL contacts\n2. **Opportunity Tracking**: View and update opportunities\n3. **Automated Responses**: Set up smart replies\n4. **Lead Qualification**: Ask qualifying questions\n\nWhat interests you most?',
          timestamp: new Date()
        }];
      });
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const testMCPConnection = async () => {
    const testKey = 'connection';
    setTestProgress(prev => ({ ...prev, [testKey]: 'running' }));
    setRunningTests(prev => new Set([...prev, testKey]));
    
    try {
      setMcpTestResults(prev => [...prev, { type: 'testing', message: 'Testing MCP connection...', timestamp: new Date(), testKey }]);
      
      const response = await fetch('/api/mcp/ghl/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' })
      });
      
      const data = await response.json();
      const success = response.ok;
      
      setTestProgress(prev => ({ ...prev, [testKey]: success ? 'success' : 'error' }));
      setRunningTests(prev => { const newSet = new Set(prev); newSet.delete(testKey); return newSet; });
      
      setMcpTestResults(prev => [...prev, {
        type: success ? 'success' : 'error',
        message: data.message || 'Connection test completed',
        timestamp: new Date(),
        data: data,
        testKey
      }]);
    } catch (error) {
      setTestProgress(prev => ({ ...prev, [testKey]: 'error' }));
      setRunningTests(prev => { const newSet = new Set(prev); newSet.delete(testKey); return newSet; });
      
      setMcpTestResults(prev => [...prev, {
        type: 'error',
        message: 'Failed to test MCP connection',
        timestamp: new Date(),
        error: error,
        testKey
      }]);
    }
  };

  const testMCPAPICall = async (method: string) => {
    const testKey = method;
    setTestProgress(prev => ({ ...prev, [testKey]: 'running' }));
    setRunningTests(prev => new Set([...prev, testKey]));
    
    try {
      setMcpTestResults(prev => [...prev, { 
        type: 'testing', 
        message: `Testing ${method} API call...`, 
        timestamp: new Date(),
        testKey 
      }]);
      
      const response = await fetch('/api/mcp/ghl/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_api', method })
      });
      
      const data = await response.json();
      const success = response.ok;
      
      setTestProgress(prev => ({ ...prev, [testKey]: success ? 'success' : 'error' }));
      setRunningTests(prev => { const newSet = new Set(prev); newSet.delete(testKey); return newSet; });
      
      setMcpTestResults(prev => [...prev, {
        type: success ? 'success' : 'error',
        message: `${method} test: ${data.message}`,
        timestamp: new Date(),
        data: data.results,
        testKey
      }]);
    } catch (error) {
      setTestProgress(prev => ({ ...prev, [testKey]: 'error' }));
      setRunningTests(prev => { const newSet = new Set(prev); newSet.delete(testKey); return newSet; });
      
      setMcpTestResults(prev => [...prev, {
        type: 'error',
        message: `${method} test failed`,
        timestamp: new Date(),
        error: error,
        testKey
      }]);
    }
  };

  const testAllInCategory = async (category: string, tools: string[]) => {
    for (const tool of tools) {
      await testMCPAPICall(tool);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const clearTestResults = () => {
    setMcpTestResults([]);
    setTestProgress({});
    setRunningTests(new Set());
  };

  const getStatusIcon = (status: 'pending' | 'running' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return <div className="w-3 h-3 rounded-full bg-gray-300"></div>;
      case 'running':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/📨/g, '<span class="text-xl">📨</span>')
      .replace(/✅/g, '<span class="text-xl">✅</span>')
      .replace(/💬/g, '<span class="text-xl">💬</span>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="h-screen max-h-screen flex flex-col bg-gray-50" style={{ height: '100vh', maxHeight: '100vh' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GoHighLevel Chatbot</h1>
              <p className="text-sm text-gray-600">
                Develop chatbot features using MCP integration
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>MCP Connected</span>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-6 mt-4">
          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <TestTube className="w-4 h-4" />
            <span>Test Chat</span>
          </button>
          
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Workflow className="w-4 h-4" />
            <span>Workflow Builder</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex min-h-0">
        {activeTab === 'test' && (
          <>
            {/* MCP Testing Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">🧪 MCP Testing Suite</h3>
                  <button
                    onClick={clearTestResults}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Clear
                  </button>
                </div>
                
                {/* Test Statistics */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-green-50 rounded border border-green-100">
                    <div className="font-bold text-purple-950">{Object.values(testProgress).filter(s => s === 'success').length}</div>
                    <div className="text-gray-700 font-medium">Pass</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded border border-red-100">
                    <div className="font-bold text-purple-950">{Object.values(testProgress).filter(s => s === 'error').length}</div>
                    <div className="text-gray-700 font-medium">Fail</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded border border-blue-100">
                    <div className="font-bold text-purple-950">{runningTests.size}</div>
                    <div className="text-gray-700 font-medium">Running</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded border border-purple-100">
                    <div className="font-bold text-purple-950">21</div>
                    <div className="text-gray-700 font-medium">Total</div>
                  </div>
                </div>
              </div>

              {/* Connection Test */}
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-purple-950">Connection Status</span>
                  {getStatusIcon(testProgress['connection'] || 'pending')}
                </div>
                <button
                  onClick={testMCPConnection}
                  disabled={runningTests.has('connection')}
                  className="w-full p-3 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 text-left disabled:opacity-50 transition-all shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <TestTube className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-purple-950 text-sm">Test MCP Connection</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 font-medium">Verify server connectivity and auth</p>
                </button>
              </div>
              
              {/* Tools Testing - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-purple-950">Quick Actions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => testMCPAPICall('listTools')}
                        disabled={runningTests.has('listTools')}
                        className="p-2 text-xs border-2 border-indigo-200 rounded hover:bg-indigo-50 disabled:opacity-50 transition-all shadow-sm"
                      >
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(testProgress['listTools'] || 'pending')}
                          <span className="font-bold text-purple-950">List Tools</span>
                        </div>
                      </button>
                      <button
                        onClick={() => testAllInCategory('all', ['getContacts', 'searchOpportunity', 'getPipelines'])}
                        disabled={runningTests.size > 0}
                        className="p-2 text-xs border-2 border-purple-200 rounded hover:bg-purple-50 disabled:opacity-50 transition-all shadow-sm"
                      >
                        <span className="font-bold text-purple-950">Test Core APIs</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Tool Categories */}
                  {[
                    {
                      name: '📅 Calendar',
                      tools: [
                        { key: 'getCalendarEvents', name: 'Get Events', desc: 'Calendar events' },
                        { key: 'getAppointmentNotes', name: 'Get Notes', desc: 'Appointment notes' }
                      ],
                      color: 'sky'
                    },
                    {
                      name: '👥 Contacts', 
                      tools: [
                        { key: 'getContacts', name: 'List', desc: 'All contacts' },
                        { key: 'getContact', name: 'Get', desc: 'Single contact' },
                        { key: 'createContact', name: 'Create', desc: 'New contact' },
                        { key: 'updateContact', name: 'Update', desc: 'Edit contact' },
                        { key: 'upsertContact', name: 'Upsert', desc: 'Create/update' },
                        { key: 'addTags', name: 'Add Tags', desc: 'Add tags' },
                        { key: 'removeTags', name: 'Remove Tags', desc: 'Remove tags' },
                        { key: 'getAllTasks', name: 'Tasks', desc: 'Contact tasks' }
                      ],
                      color: 'green'
                    },
                    {
                      name: '💬 Conversations',
                      tools: [
                        { key: 'searchConversation', name: 'Search', desc: 'Find conversations' },
                        { key: 'getConversations', name: 'List', desc: 'All conversations' },
                        { key: 'getMessages', name: 'Messages', desc: 'Get messages' },
                        { key: 'sendMessage', name: 'Send', desc: 'Send message' }
                      ],
                      color: 'blue'
                    },
                    {
                      name: '🎯 Opportunities',
                      tools: [
                        { key: 'searchOpportunity', name: 'Search', desc: 'Find opportunities' },
                        { key: 'getPipelines', name: 'Pipelines', desc: 'Sales pipelines' },
                        { key: 'getOpportunity', name: 'Get', desc: 'Single opportunity' },
                        { key: 'updateOpportunity', name: 'Update', desc: 'Edit opportunity' }
                      ],
                      color: 'purple'
                    },
                    {
                      name: '⚙️ Locations',
                      tools: [
                        { key: 'getLocation', name: 'Location', desc: 'Location details' },
                        { key: 'getCustomFields', name: 'Fields', desc: 'Custom fields' }
                      ],
                      color: 'gray'
                    },
                    {
                      name: '💳 Payments',
                      tools: [
                        { key: 'listTransactions', name: 'Transactions', desc: 'Payment history' },
                        { key: 'getOrderById', name: 'Get Order', desc: 'Order details' }
                      ],
                      color: 'emerald'
                    }
                  ].map((category) => (
                    <div key={category.name} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-purple-950">{category.name}</span>
                        <button
                          onClick={() => testAllInCategory(category.name, category.tools.map(t => t.key))}
                          disabled={runningTests.size > 0}
                          className="text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded disabled:opacity-50 transition-colors border border-purple-200 shadow-sm"
                        >
                          <span className="font-bold text-purple-950">Test All</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {category.tools.map((tool) => (
                          <button
                            key={tool.key}
                            onClick={() => testMCPAPICall(tool.key)}
                            disabled={runningTests.has(tool.key)}
                            className="p-2 text-xs border-2 border-gray-200 rounded hover:bg-gray-50 text-left disabled:opacity-50 transition-all shadow-sm"
                          >
                            <div className="flex items-center space-x-1 mb-1">
                              {getStatusIcon(testProgress[tool.key] || 'pending')}
                              <span className="font-bold text-purple-950">{tool.name}</span>
                            </div>
                            <div className="text-gray-600 text-xs truncate font-medium">{tool.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : message.type === 'system'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className={`px-4 py-3 rounded-lg ${
                        message.type === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : message.type === 'system'
                          ? 'bg-purple-100 text-purple-950 border border-purple-200'
                          : 'bg-white text-purple-950 border border-gray-200'
                      } ${message.loading ? 'animate-pulse' : ''}`}>
                        <div 
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                        />
                        <div className={`text-xs mt-2 ${
                          message.type === 'user' ? 'text-blue-100' : 'text-gray-600'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area - Always at bottom */}
              <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
                <div className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Try: 'Send Brandon a message asking him to schedule an estimate' or 'Show Mary's appointments'..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-purple-950 placeholder:text-purple-800"
                      rows={1}
                      style={{ 
                        minHeight: '44px',
                        maxHeight: '80px',
                        height: Math.min(80, Math.max(44, inputMessage.split('\n').length * 20 + 24))
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Results Panel - Right Side */}
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <h4 className="font-bold text-purple-950 mb-2">📊 Recent Results</h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <div className="space-y-3">
                  {mcpTestResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-xs shadow-sm border-2 ${
                        result.type === 'success'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : result.type === 'error'
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      }`}
                    >
                      <div className="font-bold truncate mb-1">{result.message}</div>
                      <div className="text-gray-600 font-medium">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                      {result.data && (
                        <div className="mt-2 p-2 bg-white rounded text-xs text-gray-700 font-mono">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(result.data, null, 2).slice(0, 200)}
                            {JSON.stringify(result.data, null, 2).length > 200 ? '...' : ''}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                  {mcpTestResults.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <TestTube className="w-8 h-8 mx-auto" />
                      </div>
                      <p className="text-sm text-gray-700 font-medium">No tests run yet</p>
                      <p className="text-xs text-gray-500 mt-1">Test results will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Workflow and Settings tabs */}
        {activeTab === 'workflows' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="text-center py-12">
              <Workflow className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Builder</h3>
              <p className="text-gray-500">Coming soon - Design chatbot workflows visually</p>
            </div>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Settings</h3>
              <p className="text-gray-500">Configure chatbot settings and integrations</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}