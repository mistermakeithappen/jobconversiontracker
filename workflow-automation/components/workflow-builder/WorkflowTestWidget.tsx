'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, RefreshCw, Play, Pause } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'debug' | 'backend';
  content: string;
  timestamp: Date;
  nodeId?: string;
  nodeName?: string;
  data?: any;
}

interface WorkflowTestWidgetProps {
  workflowId: string;
  botId?: string;
  nodes: any[];
  edges: any[];
  onClose?: () => void;
  onNodeExecution?: (nodeId: string | null) => void;
}

export default function WorkflowTestWidget({ workflowId, botId, nodes, edges, onClose, onNodeExecution }: WorkflowTestWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [sessionVariables, setSessionVariables] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize session
    const newSessionId = `test-${Date.now()}`;
    setSessionId(newSessionId);
    
    // Add welcome message
    setMessages([{
      id: '1',
      role: 'system',
      content: 'Workflow test session started. Type a message to begin testing your workflow.',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isExecuting) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsExecuting(true);

    try {
      // Execute workflow with the message
      const response = await fetch('/api/workflows/test/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          botId,
          sessionId,
          message: inputMessage,
          nodes,
          edges,
          variables: sessionVariables
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute workflow');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      // Stream the response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue; // Skip empty data lines
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'node_execution') {
                // Show which node is executing
                setCurrentNodeId(data.nodeId);
                if (onNodeExecution) {
                  onNodeExecution(data.nodeId);
                }
                setMessages(prev => [...prev, {
                  id: `debug-${Date.now()}-${Math.random()}`,
                  role: 'debug',
                  content: `Executing: ${data.nodeName}`,
                  timestamp: new Date(),
                  nodeId: data.nodeId,
                  nodeName: data.nodeName
                }]);
              } else if (data.type === 'message') {
                // Bot response
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: data.content,
                  timestamp: new Date(),
                  nodeId: data.nodeId
                }]);
              } else if (data.type === 'variable_update') {
                // Update session variables
                setSessionVariables(prev => ({
                  ...prev,
                  [data.variable]: data.value
                }));
                // Show variable update in backend log
                setMessages(prev => [...prev, {
                  id: `backend-var-${Date.now()}-${Math.random()}`,
                  role: 'backend',
                  content: `Variable Updated: ${data.variable} = ${JSON.stringify(data.value)}`,
                  timestamp: new Date(),
                  data: { variable: data.variable, value: data.value }
                }]);
              } else if (data.type === 'backend_log') {
                // Backend processing logs
                setMessages(prev => [...prev, {
                  id: `backend-log-${Date.now()}-${Math.random()}`,
                  role: 'backend',
                  content: data.content,
                  timestamp: new Date(),
                  data: data.data
                }]);
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'system',
                  content: `Error: ${data.message}`,
                  timestamp: new Date()
                }]);
              } else if (data.type === 'complete') {
                // Workflow complete
                if (onNodeExecution) {
                  onNodeExecution(null);
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Failed to execute workflow: ${errorMessage}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsExecuting(false);
      setCurrentNodeId(null);
      if (onNodeExecution) {
        onNodeExecution(null);
      }
    }
  };

  const resetSession = () => {
    const newSessionId = `test-${Date.now()}`;
    setSessionId(newSessionId);
    setSessionVariables({});
    setMessages([{
      id: '1',
      role: 'system',
      content: 'Session reset. Ready to test your workflow.',
      timestamp: new Date()
    }]);
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-800">Workflow Test</h3>
          {isExecuting && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span>Running</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetSession}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Reset session"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className={`flex items-start gap-2 max-w-[85%] ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white'
                  : message.role === 'debug'
                  ? 'bg-yellow-500 text-white'
                  : message.role === 'backend'
                  ? 'bg-gray-500 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-600 text-white'
                  : 'bg-purple-600 text-white'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : message.role === 'debug' ? (
                  <Play className="w-3 h-3" />
                ) : message.role === 'backend' ? (
                  <RefreshCw className="w-3 h-3" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              
              <div>
                {message.nodeName && (
                  <div className="text-xs text-gray-500 mb-1">
                    {message.nodeName}
                  </div>
                )}
                <div className={`px-3 py-2 rounded-lg text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'debug'
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : message.role === 'backend'
                    ? 'bg-gray-50 text-gray-600 border border-gray-300 font-mono text-xs'
                    : message.role === 'system'
                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                    : 'bg-purple-50 text-gray-800 border border-purple-200'
                }`}>
                  {message.content}
                </div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-right text-gray-500' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Session Variables */}
      {Object.keys(sessionVariables).length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-600">
            <div className="font-semibold mb-1">Session Variables:</div>
            <div className="font-mono text-xs bg-white p-2 rounded border border-gray-200">
              {JSON.stringify(sessionVariables, null, 2)}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message to test..."
            className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 bg-white"
            disabled={isExecuting}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isExecuting}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}