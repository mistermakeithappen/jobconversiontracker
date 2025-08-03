'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Bot as BotIcon, User, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  is_active: boolean;
  specific_context?: string;
  global_context?: string;
  personality_config?: {
    tone?: string;
    style?: string;
    response_length?: string;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  bot_id: string;
  session_variables: Record<string, any>;
  conversation_history: Message[];
  created_at: string;
  updated_at: string;
}

export default function BotTestPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [bot, setBot] = useState<Bot | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchBotAndStartSession();
  }, [botId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchBotAndStartSession = async () => {
    try {
      setIsLoading(true);
      
      // Fetch bot details
      const botResponse = await fetch(`/api/bots?botId=${botId}`);
      if (!botResponse.ok) throw new Error('Failed to fetch bot');
      const botData = await botResponse.json();
      setBot(botData);

      // Start a new chat session
      const sessionResponse = await fetch(`/api/chatbot/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId })
      });
      
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSession(sessionData);
        setMessages([{
          id: Date.now().toString(),
          role: 'system',
          content: `Welcome! I'm ${botData.name}. ${botData.description || 'How can I help you today?'}`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error initializing test:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending || !session) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      const response = await fetch(`/api/chatbot/bot/${botId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          session_id: session.id
        })
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Update session if needed
      if (data.session) {
        setSession(data.session);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetSession = async () => {
    await fetchBotAndStartSession();
  };

  const clearHistory = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'system',
      content: `Chat history cleared. I'm ${bot?.name}. How can I help you?`,
      timestamp: new Date()
    }]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bot test environment...</p>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Bot not found</p>
          <Link href="/chatbot" className="text-purple-600 hover:text-purple-700">
            Back to Bot Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/chatbot"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              {bot.avatar_url ? (
                <img src={bot.avatar_url} alt={bot.name} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                  <BotIcon className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Test: {bot.name}</h1>
                <p className="text-sm text-gray-600">
                  {bot.is_active ? 'Active' : 'Inactive'} • Session ID: {session?.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={resetSession}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset session"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={clearHistory}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Clear history"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white'
                    : message.role === 'system'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <BotIcon className="w-4 h-4" />
                  )}
                </div>
                
                <div className={`px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'system'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <BotIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="px-4 py-3 rounded-lg bg-white border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '120px'
              }}
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
          
          {/* Session Info */}
          <div className="mt-2 text-xs text-gray-500">
            {session && (
              <div>
                Session variables: {JSON.stringify(session.session_variables)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}