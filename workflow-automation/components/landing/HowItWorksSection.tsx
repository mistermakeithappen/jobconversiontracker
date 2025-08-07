'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Camera, MessageSquare, CheckCircle, DollarSign, Smartphone } from 'lucide-react';

const steps = [
  {
    id: 1,
    title: 'Employee Texts Receipt',
    description: 'Snap a photo and send it via SMS',
    icon: Camera,
    messages: [
      { from: 'user', text: 'Just bought materials for Johnson job', image: true },
      { from: 'ai', text: 'Got it! Receipt from Home Depot for $234.56. Is this for the Johnson bathroom remodel?' },
      { from: 'user', text: 'Yes' },
      { from: 'ai', text: '✓ Added to Johnson project. Running profit: $1,847 (68% margin)' },
    ],
  },
  {
    id: 2,
    title: 'AI Processes Instantly',
    description: 'Extracts vendor, amount, and date automatically',
    icon: MessageSquare,
    animation: 'processing',
  },
  {
    id: 3,
    title: 'Smart Job Matching',
    description: 'AI matches receipt to the right project',
    icon: CheckCircle,
    animation: 'matching',
  },
  {
    id: 4,
    title: 'Real-Time Profit Update',
    description: 'Dashboard updates with true profit margins',
    icon: DollarSign,
    animation: 'dashboard',
  },
];

export default function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [activeStep, setActiveStep] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(0);

  // Auto-advance steps
  useEffect(() => {
    if (!isInView) return;
    
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
      setVisibleMessages(0);
    }, 5000);

    return () => clearInterval(interval);
  }, [isInView]);

  // Show messages progressively
  useEffect(() => {
    if (activeStep !== 0) return;
    
    const interval = setInterval(() => {
      setVisibleMessages((prev) => {
        if (prev < steps[0].messages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [activeStep]);

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your entire business managed through simple text conversations
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="mx-auto max-w-sm">
              <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="bg-white rounded-[2rem] p-6 h-[600px] overflow-hidden">
                  {/* Phone Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Business AI</p>
                        <p className="text-xs text-green-500">Active now</p>
                      </div>
                    </div>
                    <Smartphone className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Messages */}
                  {activeStep === 0 && (
                    <div className="space-y-4">
                      {steps[0].messages.map((msg, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ 
                            opacity: index <= visibleMessages ? 1 : 0,
                            y: index <= visibleMessages ? 0 : 20
                          }}
                          transition={{ duration: 0.3 }}
                          className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${
                            msg.from === 'user' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-800'
                          } rounded-2xl px-4 py-3`}>
                            {msg.image ? (
                              <div className="space-y-2">
                                <p className="text-sm">{msg.text}</p>
                                <div className="bg-white/20 rounded-lg p-2 flex items-center justify-center">
                                  <Camera className="w-8 h-8" />
                                  <span className="ml-2 text-xs">receipt.jpg</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm">{msg.text}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Processing Animation */}
                  {activeStep === 1 && (
                    <div className="flex items-center justify-center h-full">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <div className="relative w-32 h-32 mx-auto mb-6">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full"
                          />
                          <div className="absolute inset-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <MessageSquare className="w-12 h-12 text-blue-600" />
                          </div>
                        </div>
                        <p className="text-lg font-medium text-gray-900">Processing Receipt...</p>
                        <p className="text-sm text-gray-600 mt-2">Extracting vendor, amount, date</p>
                      </motion.div>
                    </div>
                  )}

                  {/* Matching Animation */}
                  {activeStep === 2 && (
                    <div className="flex items-center justify-center h-full">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full"
                      >
                        <div className="space-y-4">
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                            <p className="font-medium text-gray-900 mb-2">Receipt Matched!</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Project:</span>
                                <span className="font-medium text-gray-900">Johnson Bathroom</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Amount:</span>
                                <span className="font-medium text-gray-900">$234.56</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Category:</span>
                                <span className="font-medium text-gray-900">Materials</span>
                              </div>
                            </div>
                          </div>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex justify-center"
                          >
                            <CheckCircle className="w-16 h-16 text-green-500" />
                          </motion.div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Dashboard Update */}
                  {activeStep === 3 && (
                    <div className="flex items-center justify-center h-full">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full"
                      >
                        <div className="bg-gray-50 rounded-lg p-6">
                          <h4 className="font-semibold text-gray-900 mb-4">Johnson Project Updated</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Revenue</span>
                              <span className="font-medium text-gray-900">$5,400</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Materials</span>
                              <motion.span 
                                className="font-medium text-red-600"
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.3 }}
                              >
                                -$1,234
                              </motion.span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Labor</span>
                              <span className="font-medium text-red-600">-$2,319</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between items-center">
                              <span className="font-semibold text-gray-900">Profit</span>
                              <motion.span 
                                className="font-bold text-green-600 text-xl"
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                              >
                                $1,847
                              </motion.span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Margin</span>
                              <span className="font-medium text-green-600">68%</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Steps */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-8"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  className={`relative pl-16 pb-8 ${index < steps.length - 1 ? 'border-l-2 border-gray-200 ml-8' : ''}`}
                  onClick={() => setActiveStep(index)}
                >
                  <div className={`absolute left-0 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg scale-110' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}>
                    <Icon className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  
                  <div className={`ml-8 transition-all duration-300 ${isActive ? 'scale-105' : ''}`}>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                    
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 p-4 bg-blue-50 rounded-lg"
                      >
                        <p className="text-sm text-blue-700">
                          {index === 0 && "Your team simply texts photos of receipts - no apps, no forms, no hassle."}
                          {index === 1 && "AI extracts all the important information in seconds with 99.9% accuracy."}
                          {index === 2 && "Automatically matches to the right job based on who sent it and recent activity."}
                          {index === 3 && "See real profit margins instantly - know exactly how much you're making on every job."}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}