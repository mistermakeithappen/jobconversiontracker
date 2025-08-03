'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, MessageCircle, Settings, Code, Sparkles, TestTube, Workflow, Volume2, Hash, Clock } from 'lucide-react';

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

    // Add loading message
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: 'Thinking...',
      timestamp: new Date(),
      loading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Call the MCP chatbot API
      const response = await fetch('/api/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage })
      });

      const data = await response.json();

      // Remove loading message and add bot response
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
      
      // Remove loading message and add error response
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
      setMcpTestResults([{ type: 'testing', message: 'Testing MCP connection...', timestamp: new Date(), testKey }]);
      
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

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br>');
  };

  const testAllInCategory = async (category: string, tools: string[]) => {
    for (const tool of tools) {
      await testMCPAPICall(tool);
      // Small delay between tests
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
        return <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>;
      case 'success':
        return <div className="w-3 h-3 rounded-full bg-green-500"></div>;
      case 'error':
        return <div className="w-3 h-3 rounded-full bg-red-500"></div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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
      <div className="flex-1 flex">
        {activeTab === 'test' && (
          <>
            {/* MCP Testing Sidebar */}
            <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-100">
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
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{Object.values(testProgress).filter(s => s === 'success').length}</div>
                    <div className="text-green-600">Pass</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{Object.values(testProgress).filter(s => s === 'error').length}</div>
                    <div className="text-red-600">Fail</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">{runningTests.size}</div>
                    <div className="text-blue-600">Running</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-medium text-gray-900">21</div>
                    <div className="text-gray-600">Total</div>
                  </div>
                </div>
              </div>

              {/* Connection Test */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Connection Status</span>
                  {getStatusIcon(testProgress['connection'] || 'pending')}
                </div>
                <button
                  onClick={testMCPConnection}
                  disabled={runningTests.has('connection')}
                  className="w-full p-3 border border-blue-200 rounded-lg hover:bg-blue-50 text-left disabled:opacity-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <TestTube className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-sm">Test MCP Connection</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Verify server connectivity and auth</p>
                </button>
              </div>
              
              {/* Tools Testing */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Quick Actions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => testMCPAPICall('listTools')}
                        disabled={runningTests.has('listTools')}
                        className="p-2 text-xs border border-indigo-200 rounded hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                      >
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(testProgress['listTools'] || 'pending')}
                          <span>List Tools</span>
                        </div>
                      </button>
                      <button
                        onClick={() => testAllInCategory('all', ['getContacts', 'getOpportunities', 'getPipelines'])}
                        disabled={runningTests.size > 0}
                        className="p-2 text-xs border border-purple-200 rounded hover:bg-purple-50 disabled:opacity-50 transition-colors"
                      >
                        Test Core APIs
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
                        { key: 'getOpportunities', name: 'List', desc: 'All opportunities' },
                        { key: 'searchOpportunity', name: 'Search', desc: 'Find opportunities' },
                        { key: 'getOpportunity', name: 'Get', desc: 'Single opportunity' },
                        { key: 'updateOpportunity', name: 'Update', desc: 'Edit opportunity' }
                      ],
                      color: 'purple'
                    },
                    {
                      name: '⚙️ System',
                      tools: [
                        { key: 'getPipelines', name: 'Pipelines', desc: 'Sales pipelines' },
                        { key: 'getLocation', name: 'Location', desc: 'Location details' },
                        { key: 'getCustomFields', name: 'Fields', desc: 'Custom fields' },
                        { key: 'getUsers', name: 'Users', desc: 'Location users' },
                        { key: 'getTags', name: 'Tags', desc: 'All tags' }
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
                        <span className="text-sm font-medium text-gray-900">{category.name}</span>
                        <button
                          onClick={() => testAllInCategory(category.name, category.tools.map(t => t.key))}
                          disabled={runningTests.size > 0}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
                        >
                          Test All
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {category.tools.map((tool) => (
                          <button
                            key={tool.key}
                            onClick={() => testMCPAPICall(tool.key)}
                            disabled={runningTests.has(tool.key)}
                            className={`p-2 text-xs border border-${category.color}-200 rounded hover:bg-${category.color}-50 text-left disabled:opacity-50 transition-colors`}
                          >
                            <div className="flex items-center space-x-1 mb-1">
                              {getStatusIcon(testProgress[tool.key] || 'pending')}
                              <span className="font-medium">{tool.name}</span>
                            </div>
                            <div className={`text-${category.color}-600 text-xs truncate`}>{tool.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Test Results Panel */}
              <div className="border-t border-gray-100 bg-gray-50">
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Recent Results</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {mcpTestResults.slice(-5).map((result, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded text-xs ${
                          result.type === 'success'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : result.type === 'error'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                        }`}
                      >
                        <div className="font-medium truncate">{result.message}</div>
                        <div className="text-gray-500 mt-1">
                          {result.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    {mcpTestResults.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No tests run yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Remove all the old tool buttons - they've been replaced above */
                <button
                  onClick={() => testMCPAPICall('getCalendarEvents')}
                  className="w-full p-2 border border-sky-200 rounded-lg hover:bg-sky-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-sky-600" />
                    <span className="font-medium text-xs">Get Calendar Events</span>
                  </div>
                  <p className="text-xs text-gray-600">Fetch calendar events by user/group/calendar ID</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getAppointmentNotes')}
                  className="w-full p-2 border border-sky-200 rounded-lg hover:bg-sky-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-sky-600" />
                    <span className="font-medium text-xs">Get Appointment Notes</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve notes for a specific appointment</p>
                </button>
                
                {/* Contact Tools */}
                <div className="text-xs font-medium text-gray-500 pt-2">👥 Contact Tools</div>
                <button
                  onClick={() => testMCPAPICall('getContacts')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Get Contacts</span>
                  </div>
                  <p className="text-xs text-gray-600">Fetch all contacts from GHL</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getContact')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Get Single Contact</span>
                  </div>
                  <p className="text-xs text-gray-600">Fetch specific contact details</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getAllTasks')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Get Contact Tasks</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve all tasks for a contact</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('createContact')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Create Contact</span>
                  </div>
                  <p className="text-xs text-gray-600">Create a new contact</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('updateContact')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Update Contact</span>
                  </div>
                  <p className="text-xs text-gray-600">Update existing contact</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('upsertContact')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Upsert Contact</span>
                  </div>
                  <p className="text-xs text-gray-600">Create or update contact</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('addTags')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Add Tags</span>
                  </div>
                  <p className="text-xs text-gray-600">Add tags to contact</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('removeTags')}
                  className="w-full p-2 border border-green-200 rounded-lg hover:bg-green-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-xs">Remove Tags</span>
                  </div>
                  <p className="text-xs text-gray-600">Remove tags from contact</p>
                </button>
                
                {/* Conversation Tools */}
                <div className="text-xs font-medium text-gray-500 pt-2">💬 Conversation Tools</div>
                <button
                  onClick={() => testMCPAPICall('searchConversation')}
                  className="w-full p-2 border border-blue-200 rounded-lg hover:bg-blue-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-xs">Search Conversations</span>
                  </div>
                  <p className="text-xs text-gray-600">Search/filter/sort conversations</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getConversations')}
                  className="w-full p-2 border border-blue-200 rounded-lg hover:bg-blue-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-xs">Get Conversations</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve conversation history</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getMessages')}
                  className="w-full p-2 border border-blue-200 rounded-lg hover:bg-blue-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-xs">Get Messages</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve messages by conversation ID</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('sendMessage')}
                  className="w-full p-2 border border-blue-200 rounded-lg hover:bg-blue-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-xs">Send Message</span>
                  </div>
                  <p className="text-xs text-gray-600">Send a new message to conversation</p>
                </button>
                
                {/* Opportunity Tools */}
                <div className="text-xs font-medium text-gray-500 pt-2">🎯 Opportunity Tools</div>
                <button
                  onClick={() => testMCPAPICall('getOpportunities')}
                  className="w-full p-2 border border-purple-200 rounded-lg hover:bg-purple-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-xs">Get Opportunities</span>
                  </div>
                  <p className="text-xs text-gray-600">Fetch opportunities from GHL</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('searchOpportunity')}
                  className="w-full p-2 border border-purple-200 rounded-lg hover:bg-purple-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-xs">Search Opportunities</span>
                  </div>
                  <p className="text-xs text-gray-600">Search opportunities by criteria</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getOpportunity')}
                  className="w-full p-2 border border-purple-200 rounded-lg hover:bg-purple-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-xs">Get Single Opportunity</span>
                  </div>
                  <p className="text-xs text-gray-600">Get specific opportunity by ID</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('updateOpportunity')}
                  className="w-full p-2 border border-purple-200 rounded-lg hover:bg-purple-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-xs">Update Opportunity</span>
                  </div>
                  <p className="text-xs text-gray-600">Update existing opportunity</p>
                </button>
                
                {/* Pipeline & Location Tools */}
                <div className="text-xs font-medium text-gray-500 pt-2">⚙️ System Tools</div>
                <button
                  onClick={() => testMCPAPICall('getPipelines')}
                  className="w-full p-2 border border-orange-200 rounded-lg hover:bg-orange-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-orange-600" />
                    <span className="font-medium text-xs">Get Pipelines</span>
                  </div>
                  <p className="text-xs text-gray-600">Fetch all pipelines</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getLocation')}
                  className="w-full p-2 border border-teal-200 rounded-lg hover:bg-teal-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-teal-600" />
                    <span className="font-medium text-xs">Get Location</span>
                  </div>
                  <p className="text-xs text-gray-600">Get location details</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getCustomFields')}
                  className="w-full p-2 border border-teal-200 rounded-lg hover:bg-teal-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-teal-600" />
                    <span className="font-medium text-xs">Get Custom Fields</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve custom field definitions</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getUsers')}
                  className="w-full p-2 border border-pink-200 rounded-lg hover:bg-pink-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-pink-600" />
                    <span className="font-medium text-xs">Get Users</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve users in location</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getTags')}
                  className="w-full p-2 border border-yellow-200 rounded-lg hover:bg-yellow-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-yellow-600" />
                    <span className="font-medium text-xs">Get Tags</span>
                  </div>
                  <p className="text-xs text-gray-600">Retrieve all location tags</p>
                </button>

                {/* Payment Tools */}
                <div className="text-xs font-medium text-gray-500 pt-2">💳 Payment Tools</div>
                <button
                  onClick={() => testMCPAPICall('listTransactions')}
                  className="w-full p-2 border border-emerald-200 rounded-lg hover:bg-emerald-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-emerald-600" />
                    <span className="font-medium text-xs">List Transactions</span>
                  </div>
                  <p className="text-xs text-gray-600">List payment transactions</p>
                </button>

                <button
                  onClick={() => testMCPAPICall('getOrderById')}
                  className="w-full p-2 border border-emerald-200 rounded-lg hover:bg-emerald-50 text-left"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Code className="w-3 h-3 text-emerald-600" />
                    <span className="font-medium text-xs">Get Order by ID</span>
                  </div>
                  <p className="text-xs text-gray-600">Get order details by ID</p>
                </button>
              </div>
              
              {/* Test Results */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Test Results</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {mcpTestResults.length === 0 ? (
                    <p className="text-sm text-gray-500">No tests run yet</p>
                  ) : (
                    mcpTestResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded text-xs ${
                          result.type === 'success'
                            ? 'bg-green-50 text-green-800'
                            : result.type === 'error'
                            ? 'bg-red-50 text-red-800'
                            : 'bg-yellow-50 text-yellow-800'
                        }`}
                      >
                        <div className="font-medium">{result.message}</div>
                        <div className="text-gray-500 mt-1">
                          {result.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Quick Commands</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/contacts</code> - Search contacts</div>
                  <div><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/opportunities</code> - View opportunities</div>
                  <div><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/help</code> - Show available features</div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'workflows' && (
          <div className="w-80 bg-white border-r border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">🔄 Workflow Management</h3>
            
            <div className="space-y-3 mb-6">
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <Hash className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Tag-Based Workflows</span>
                </div>
                <p className="text-xs text-gray-600">Create workflows triggered by contact tags</p>
              </div>
              
              <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-300 text-gray-600 hover:text-purple-600">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">+</span>
                  <span className="font-medium text-sm">Create New Workflow</span>
                </div>
              </button>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Example Workflows</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <div className="font-medium">Appointment Setter</div>
                  <div className="text-gray-600">Tag: appointment-setter</div>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <div className="font-medium">Lead Qualifier</div>
                  <div className="text-gray-600">Tag: new-lead</div>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <div className="font-medium">Customer Support</div>
                  <div className="text-gray-600">Tag: support-needed</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="w-80 bg-white border-r border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">⚙️ Universal Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Volume2 className="w-4 h-4 inline mr-1" />
                  Tonality
                </label>
                <select className="w-full p-2 border border-gray-300 rounded-lg">
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Casual</option>
                  <option>Formal</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typos per 100 words
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  defaultValue="1"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Perfect</span>
                  <span>Human-like</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Max Response Length
                </label>
                <input
                  type="number"
                  defaultValue="150"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  placeholder="Characters"
                />
              </div>
              
              <button className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700">
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'test' && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : 'bg-white text-gray-900 border border-gray-200'
                      } ${message.loading ? 'animate-pulse' : ''}`}>
                        <div 
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                        />
                        <div className={`text-xs mt-2 ${
                          message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me to help build a chatbot feature, or try commands like /contacts, /opportunities..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={1}
                      style={{ 
                        minHeight: '44px',
                        maxHeight: '120px',
                        height: Math.min(120, Math.max(44, inputMessage.split('\n').length * 20 + 24))
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
            </>
          )}

          {activeTab === 'workflows' && (
            <div className="flex-1 p-6 bg-gray-50">
              <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center py-12">
                    <Workflow className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Visual Workflow Builder</h3>
                    <p className="text-gray-600 mb-6">
                      Design conversation flows with drag-and-drop interface. Create checkpoints, branching logic, 
                      and actions like adding tags or sending webhooks.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <Hash className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <h4 className="font-medium text-sm">Tag-Based Triggers</h4>
                        <p className="text-xs text-gray-600 mt-1">Workflows activate when contacts have specific tags</p>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <Code className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <h4 className="font-medium text-sm">Branching Logic</h4>
                        <p className="text-xs text-gray-600 mt-1">Create decision points based on user responses</p>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <Zap className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                        <h4 className="font-medium text-sm">Actions & Webhooks</h4>
                        <p className="text-xs text-gray-600 mt-1">Add tags, send webhooks, or continue conversations</p>
                      </div>
                    </div>
                    
                    <button className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
                      Coming Soon - Workflow Canvas
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 p-6 bg-gray-50">
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Universal Chatbot Settings</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Personality & Tone</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tonality Style</label>
                          <select className="w-full p-3 border border-gray-300 rounded-lg">
                            <option>Professional</option>
                            <option>Friendly</option>
                            <option>Casual</option>
                            <option>Formal</option>
                            <option>Enthusiastic</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Response Speed</label>
                          <select className="w-full p-3 border border-gray-300 rounded-lg">
                            <option>Instant</option>
                            <option>1-2 seconds</option>
                            <option>3-5 seconds</option>
                            <option>Natural typing speed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Human-like Behavior</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Typos per 100 words: <span className="text-purple-600">1</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="5"
                            defaultValue="1"
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Perfect Grammar</span>
                            <span>Very Human-like</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Max Response Length</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              defaultValue="150"
                              className="flex-1 p-3 border border-gray-300 rounded-lg"
                              placeholder="Characters"
                            />
                            <span className="text-sm text-gray-500">characters</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Context & Memory</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">Remember conversation history</div>
                            <div className="text-xs text-gray-600">Keep context across multiple messages</div>
                          </div>
                          <input type="checkbox" defaultChecked className="w-4 h-4" />
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">Use GHL contact data</div>
                            <div className="text-xs text-gray-600">Personalize responses with contact information</div>
                          </div>
                          <input type="checkbox" defaultChecked className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <button className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors">
                        Save All Settings
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}