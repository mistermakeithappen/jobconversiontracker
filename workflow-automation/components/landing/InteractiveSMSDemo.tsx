'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { MessageSquare, Send, Smartphone, Bot, Sparkles } from 'lucide-react';

const prebaked = [
  {
    id: 'profit',
    prompt: "Show me today's profit",
    conversation: [
      { from: 'user', text: "Show me today's profit" },
      { from: 'ai', text: "Today's performance (as of 5:47 PM):\n\n💰 Revenue: $12,340\n📊 Expenses: $3,876\n✅ Profit: $8,464\n📈 Margin: 68.6%\n\nTop job: Johnson bathroom ($3,200 profit)" }
    ]
  },
  {
    id: 'available',
    prompt: "Who's available now?",
    conversation: [
      { from: 'user', text: "Who's available now?" },
      { from: 'ai', text: "Currently available (5:47 PM):\n\n🟢 Mike - Field Tech (finishing up)\n🟢 Sarah - Sales (in office)\n🔴 Tom - On Williams job\n🟢 Lisa - Admin (remote)\n\nNeed me to assign someone to a job?" }
    ]
  },
  {
    id: 'hours',
    prompt: "Track my hours",
    conversation: [
      { from: 'user', text: "Track my hours" },
      { from: 'ai', text: "What job are you working on? Reply with:\n1️⃣ Johnson Bathroom\n2️⃣ Williams Kitchen\n3️⃣ Davis Renovation\n\nOr text the job name." },
      { from: 'user', text: "1" },
      { from: 'ai', text: "Started tracking time on Johnson Bathroom at 5:47 PM. Text 'done' when finished.\n\nToday: 4.5 hrs on this job\nThis week: 28 hrs total" }
    ]
  },
  {
    id: 'bestjob',
    prompt: "What's my best job this month?",
    conversation: [
      { from: 'user', text: "What's my best job this month?" },
      { from: 'ai', text: "Your top performers this month:\n\n🥇 Henderson Kitchen\n• Revenue: $18,500\n• Profit: $12,100 (65%)\n• Time: 3 days\n\n🥈 Martinez Bathroom\n• Revenue: $12,000\n• Profit: $8,400 (70%)\n\n🥉 Johnson Full Reno\n• Revenue: $45,000\n• Profit: $18,000 (40%)" }
    ]
  }
];

const demoScenarios = [
  {
    id: 'receipt',
    title: 'Receipt Processing',
    icon: '📸',
    initialMessage: 'Try it: Send "I just bought supplies"',
    responses: {
      'bought supplies': 'Great! Send me a photo of the receipt and I\'ll process it for you.',
      'receipt': 'I\'ll help you track that expense. Just text me a photo of the receipt.',
      'expenses': 'I can track all your expenses. Text me photos of receipts anytime!',
      default: 'I help with receipts, scheduling, commissions, and more. Try asking about any of these!'
    }
  },
  {
    id: 'schedule',
    title: 'Check Schedule',
    icon: '📅',
    initialMessage: 'Try it: Ask "What\'s my schedule?"',
    responses: {
      'schedule': 'Tomorrow you have:\n• 8am - Johnson bathroom (123 Main St)\n• 2pm - Williams kitchen estimate\n• 4pm - Team meeting',
      'tomorrow': 'You\'re scheduled for Johnson bathroom at 8am and Williams estimate at 2pm.',
      'available': 'You have openings Tuesday afternoon and all day Thursday.',
      default: 'I can help with scheduling! Ask about your schedule, availability, or appointments.'
    }
  },
  {
    id: 'commission',
    title: 'Commission Check',
    icon: '💰',
    initialMessage: 'Try it: Ask "What\'s my commission?"',
    responses: {
      'commission': 'This month: $4,832 earned\n• 12 closed deals\n• 3 pending ($1,240)\n• You\'re $660 from Gold tier!',
      'earnings': 'You\'ve earned $4,832 in commissions this month. Great work!',
      'sales': 'You\'ve closed 12 deals worth $67,400 this month.',
      default: 'I track all your commissions and sales. Ask about earnings, deals, or tier status!'
    }
  }
];

export default function InteractiveSMSDemo() {
  const ref = useRef(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [activeScenario, setActiveScenario] = useState(demoScenarios[0]);
  const [messages, setMessages] = useState<Array<{from: string, text: string}>>([
    { from: 'ai', text: activeScenario.initialMessage }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { from: 'user', text: userMessage }]);
    setInputValue('');

    // Find matching response
    setTimeout(() => {
      const lowerMessage = userMessage.toLowerCase();
      let response = activeScenario.responses.default;
      
      for (const [key, value] of Object.entries(activeScenario.responses)) {
        if (key !== 'default' && lowerMessage.includes(key)) {
          response = value;
          break;
        }
      }

      setMessages(prev => [...prev, { from: 'ai', text: response }]);
    }, 1000);
  };

  const playPrebaked = (demo: typeof prebaked[0]) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setMessages([]);
    
    // Play through the conversation
    demo.conversation.forEach((msg, index) => {
      setTimeout(() => {
        setMessages(prev => [...prev, msg]);
        if (index === demo.conversation.length - 1) {
          setIsAnimating(false);
        }
      }, index * 1500);
    });
  };

  const switchScenario = (scenario: typeof demoScenarios[0]) => {
    setActiveScenario(scenario);
    setMessages([{ from: 'ai', text: scenario.initialMessage }]);
    setInputValue('');
  };

  return (
    <section ref={ref} className="py-24 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Demo</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Try It Yourself - No Sign Up Required
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience how your team will interact with the AI. Type a message below to see it in action.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Scenario Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 mb-8"
          >
            {demoScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => switchScenario(scenario)}
                className={`px-6 py-3 rounded-full font-medium transition-all ${
                  activeScenario.id === scenario.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:shadow-md'
                }`}
              >
                <span className="mr-2">{scenario.icon}</span>
                {scenario.title}
              </button>
            ))}
          </motion.div>

          {/* Phone Interface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto max-w-md"
          >
            <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
              <div className="bg-white rounded-[2rem] overflow-hidden">
                {/* Phone Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold">Business AI Assistant</p>
                        <p className="text-xs text-blue-100">Always here to help</p>
                      </div>
                    </div>
                    <Smartphone className="w-5 h-5 opacity-50" />
                  </div>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="h-[400px] overflow-y-auto p-4 space-y-3">
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.from === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        <p className="text-sm whitespace-pre-line">{message.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex space-x-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Suggestions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-gray-600 mb-3">Try these messages:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {prebaked.map((demo) => (
                <button
                  key={demo.id}
                  onClick={() => playPrebaked(demo)}
                  disabled={isAnimating}
                  className={`px-4 py-2 bg-white border border-gray-300 rounded-full text-sm transition-all ${
                    isAnimating 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
                  }`}
                >
                  {demo.prompt}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Feature Callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-12 bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                This is How Simple It Really Is
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                No apps to download. No passwords to remember. No training needed. 
                Your team just texts like they already do, and AI handles everything else.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}