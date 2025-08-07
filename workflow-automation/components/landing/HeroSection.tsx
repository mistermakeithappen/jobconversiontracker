'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Smartphone, TrendingUp, Users, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const messages = [
  { from: 'field', text: "Just finished Johnson job", delay: 0 },
  { from: 'ai', text: "Great! Marked complete. You logged 4.5 hours. Any expenses?", delay: 1 },
  { from: 'field', text: "Yes", attachment: true, delay: 2 },
  { from: 'ai', text: "Added $234.56 in materials. Johnson job profit: $1,847 (68% margin)", delay: 3 },
  { from: 'sales', text: "What's my commission this month?", delay: 4 },
  { from: 'ai', text: "You've earned $4,832. 3 pending deals would add $1,240. You're $660 from next tier!", delay: 5 },
  { from: 'manager', text: "Show me who's available tomorrow", delay: 6 },
  { from: 'ai', text: "3 techs available: Mike (all day), Sarah (after 2pm), Tom (morning). Assign Watson job?", delay: 7 },
];

function PhoneDemo({ visibleMessages }: { visibleMessages: number }) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  return (
    <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
      <div className="bg-white rounded-[2rem] overflow-hidden w-[320px]">
        {/* Phone Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Business AI</p>
                <p className="text-xs text-blue-100">Always Active</p>
              </div>
            </div>
            <Smartphone className="w-5 h-5 opacity-50" />
          </div>
        </div>
        
        {/* Messages Container with Scroll */}
        <div ref={messagesContainerRef} className="h-[500px] overflow-y-auto bg-gray-50">
          <div className="p-4 space-y-3">
            {messages.slice(0, visibleMessages + 1).map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col ${msg.from === 'ai' ? 'items-start' : 'items-end'}`}
              >
                {/* Sender label */}
                {msg.from !== 'ai' && (
                  <span className="text-xs text-gray-500 mb-1 mr-2">
                    {msg.from === 'field' && 'Mike (Field Tech)'}
                    {msg.from === 'sales' && 'Sarah (Sales)'}
                    {msg.from === 'manager' && 'John (Manager)'}
                  </span>
                )}
                
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.from === 'ai' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                }`}>
                  {msg.attachment ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">📸 Receipt.jpg</span>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.text}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [dashboardStats, setDashboardStats] = useState({
    revenue: 45892,
    expenses: 12456,
    profit: 33436,
    margin: 72.8,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleMessages((prev) => {
        if (prev < messages.length - 1) {
          return prev + 1;
        }
        return 0;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Update dashboard when certain messages appear
    if (visibleMessages === 3) {
      setDashboardStats({
        revenue: 47739,
        expenses: 12690,
        profit: 35049,
        margin: 73.4,
      });
    }
  }, [visibleMessages]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => {
          // Use deterministic values based on index
          const startX = ((i * 97) % 1920);
          const startY = ((i * 113) % 1080);
          const endX = (((i + 10) * 137) % 1920);
          const endY = (((i + 10) * 149) % 1080);
          const duration = 10 + (i % 10) * 2;
          
          return (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-20"
              initial={{ 
                x: startX,
                y: startY,
              }}
              animate={{
                x: endX,
                y: endY,
              }}
              transition={{
                duration: duration,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Headlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            The Only CRM Your Team
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Already Knows How to Use
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
            Because it works through text messages. Zero training. Zero resistance. 100% adoption from day one.
          </p>
        </motion.div>

        {/* Central Animation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          {/* Left side - Central Phone Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center"
          >
            <PhoneDemo visibleMessages={visibleMessages} />
          </motion.div>

          {/* Right side - Dashboard */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-[500px] mx-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Live Dashboard</h3>
              <span className="flex items-center text-green-500 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Real-time
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                className="bg-gray-50 rounded-lg p-4"
                animate={{ scale: dashboardStats.revenue > 45892 ? [1, 1.05, 1] : 1 }}
              >
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${dashboardStats.revenue.toLocaleString()}</p>
              </motion.div>
              <motion.div 
                className="bg-gray-50 rounded-lg p-4"
                animate={{ scale: dashboardStats.expenses > 12456 ? [1, 1.05, 1] : 1 }}
              >
                <p className="text-sm text-gray-600">Expenses</p>
                <p className="text-2xl font-bold text-gray-900">${dashboardStats.expenses.toLocaleString()}</p>
              </motion.div>
              <motion.div 
                className="bg-green-50 rounded-lg p-4"
                animate={{ scale: dashboardStats.profit > 33436 ? [1, 1.05, 1] : 1 }}
              >
                <p className="text-sm text-gray-600">Profit</p>
                <p className="text-2xl font-bold text-green-600">${dashboardStats.profit.toLocaleString()}</p>
              </motion.div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Margin</p>
                <p className="text-2xl font-bold text-blue-600">{dashboardStats.margin}%</p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Active Team Members</span>
                <span className="font-semibold">24/24</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Messages Today</span>
                <span className="font-semibold">342</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Receipts Processed</span>
                <span className="font-semibold">47</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-16 flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6"
        >
          <Link 
            href="/signup"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
          >
            <span>Start Free - No Training Required</span>
            <CheckCircle className="w-5 h-5" />
          </Link>
          <button className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:border-gray-400 hover:shadow-md transform hover:scale-105 transition-all duration-200 flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Text 'DEMO' to (555) 123-4567</span>
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          <div>
            <p className="text-3xl font-bold text-gray-900">100%</p>
            <p className="text-gray-600">Team Adoption Rate</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">0 min</p>
            <p className="text-gray-600">Training Time</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">5 sec</p>
            <p className="text-gray-600">Per Receipt</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">24/7</p>
            <p className="text-gray-600">AI Assistant</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}