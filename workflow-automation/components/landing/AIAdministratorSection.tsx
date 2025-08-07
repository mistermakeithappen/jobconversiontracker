'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Bot, MessageSquare, Receipt, Calendar, TrendingUp, Users, Clock, Zap } from 'lucide-react';

const incomingRequests = [
  { id: 1, type: 'receipt', from: 'Mike', text: 'Receipt from Home Depot', icon: Receipt },
  { id: 2, type: 'schedule', from: 'Sarah', text: "What's my schedule tomorrow?", icon: Calendar },
  { id: 3, type: 'commission', from: 'John', text: 'Calculate my commission', icon: TrendingUp },
  { id: 4, type: 'availability', from: 'Manager', text: 'Who can take emergency call?', icon: Users },
  { id: 5, type: 'time', from: 'Tom', text: 'Log 6 hours on Williams job', icon: Clock },
];

export default function AIAdministratorSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [activeRequests, setActiveRequests] = useState<number[]>([]);
  const [processedRequests, setProcessedRequests] = useState<number[]>([]);

  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setActiveRequests(prev => {
        const newActive = [...prev];
        const available = incomingRequests.filter(r => 
          !newActive.includes(r.id) && !processedRequests.includes(r.id)
        );
        
        if (available.length > 0 && newActive.length < 3) {
          newActive.push(available[0].id);
        }
        
        return newActive;
      });
    }, 1000);

    const processInterval = setInterval(() => {
      setActiveRequests(prev => {
        if (prev.length > 0) {
          const [processed, ...rest] = prev;
          setProcessedRequests(p => [...p, processed]);
          return rest;
        }
        return prev;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(processInterval);
    };
  }, [isInView, processedRequests]);

  // Reset processed requests when all are done
  useEffect(() => {
    if (processedRequests.length === incomingRequests.length) {
      setTimeout(() => {
        setProcessedRequests([]);
      }, 3000);
    }
  }, [processedRequests]);

  return (
    <section ref={ref} className="py-24 bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            The AI Administrator That Never Sleeps
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Handles thousands of requests simultaneously. Responds in seconds. Never takes a day off.
          </p>
        </motion.div>

        <div className="relative">
          {/* Central AI Hub */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto w-64 h-64 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full animate-pulse opacity-20"></div>
            <div className="absolute inset-4 bg-white rounded-full shadow-2xl flex items-center justify-center">
              <Bot className="w-24 h-24 text-purple-600" />
            </div>
            
            {/* Processing indicator */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
            >
              <svg className="w-full h-full">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="url(#gradient)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="20 10"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9333EA" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </motion.div>

          {/* Incoming Requests */}
          {incomingRequests.map((request, index) => {
            const angle = (index * 72) * Math.PI / 180;
            const radius = 300;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isActive = activeRequests.includes(request.id);
            const isProcessed = processedRequests.includes(request.id);
            const Icon = request.icon;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: isInView ? 1 : 0, 
                  scale: isInView ? 1 : 0,
                  x: isActive ? x * 0.3 : x,
                  y: isActive ? y * 0.3 : y,
                }}
                transition={{ 
                  duration: 0.6, 
                  delay: 0.4 + index * 0.1,
                  x: { duration: 0.5 },
                  y: { duration: 0.5 }
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div className={`bg-white rounded-lg shadow-lg p-4 w-48 transform transition-all duration-300 ${
                  isActive ? 'scale-110 shadow-xl ring-2 ring-purple-400' : ''
                } ${isProcessed ? 'opacity-50' : ''}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} />
                    <span className="font-medium text-gray-900">{request.from}</span>
                  </div>
                  <p className="text-sm text-gray-600">{request.text}</p>
                  {isProcessed && (
                    <div className="mt-2 flex items-center text-green-600">
                      <Zap className="w-4 h-4 mr-1" />
                      <span className="text-xs font-medium">Processed</span>
                    </div>
                  )}
                </div>

                {/* Connection line */}
                {isActive && (
                  <svg className="absolute top-1/2 left-1/2 -z-10" style={{ width: '500px', height: '500px', transform: 'translate(-50%, -50%)' }}>
                    <motion.line
                      x1="0"
                      y1="0"
                      x2={-x * 0.7}
                      y2={-y * 0.7}
                      stroke="url(#gradient-line)"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                    <defs>
                      <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#9333EA" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.5" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">&lt; 3s</p>
            <p className="text-gray-600 mt-2">Response Time</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">1000+</p>
            <p className="text-gray-600 mt-2">Requests/Hour</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">99.9%</p>
            <p className="text-gray-600 mt-2">Accuracy</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">24/7</p>
            <p className="text-gray-600 mt-2">Availability</p>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-20 grid md:grid-cols-3 gap-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Receipt Processing</h3>
            <p className="text-gray-600">Automatically extracts data, matches to jobs, and categorizes expenses in seconds.</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Intelligent Scheduling</h3>
            <p className="text-gray-600">Knows everyone's availability, skills, and location to optimize assignments.</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-Time Analytics</h3>
            <p className="text-gray-600">Instant profit calculations, commission tracking, and performance metrics.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}