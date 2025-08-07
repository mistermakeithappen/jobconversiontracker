'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Users, GraduationCap, Clock, TrendingUp, X } from 'lucide-react';

export default function ZeroTrainingSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const stats = [
    { label: 'Traditional CRM Training', value: '6 weeks', negative: true },
    { label: 'Our Training Time', value: '0 minutes', positive: true },
    { label: 'Average CRM Adoption', value: '47%', negative: true },
    { label: 'Our Adoption Rate', value: '100%', positive: true },
  ];

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Zero Training Required
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            If they can text, they can use it. No logins to remember. No apps to download. No interfaces to learn.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Traditional CRM Scene */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-red-50 rounded-2xl p-8 border-2 border-red-100">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <X className="w-8 h-8 text-red-500 mr-3" />
                Traditional CRM Training
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-gray-700">Week 1-2: Login procedures & navigation</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-gray-700">Week 3-4: Data entry & workflows</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-gray-700">Week 5-6: Reports & advanced features</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <p className="text-gray-700">Ongoing: Refresher training & support</p>
                </div>
              </div>

              <div className="mt-6 bg-red-100 rounded-lg p-4">
                <p className="text-red-700 font-medium">Result: 53% never fully adopt the system</p>
              </div>
            </div>
          </motion.div>

          {/* Our Solution */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="relative"
          >
            <div className="bg-green-50 rounded-2xl p-8 border-2 border-green-100">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <Users className="w-8 h-8 text-green-500 mr-3" />
                Our "Training"
              </h3>
              
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <p className="text-lg font-medium text-gray-900 mb-2">Step 1:</p>
                  <p className="text-gray-700">"Save this number in your phone"</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <p className="text-lg font-medium text-gray-900 mb-2">Step 2:</p>
                  <p className="text-gray-700">"Text it like you would text anyone"</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <p className="text-lg font-medium text-gray-900 mb-2">Step 3:</p>
                  <p className="text-gray-700">There is no step 3. They're already using it.</p>
                </div>
              </div>

              <div className="mt-6 bg-green-100 rounded-lg p-4">
                <p className="text-green-700 font-medium">Result: 100% adoption in minutes</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Comparison Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className={`text-3xl font-bold ${
                stat.positive ? 'text-green-600' : stat.negative ? 'text-red-600' : 'text-gray-900'
              }`}>
                {stat.value}
              </p>
              <p className="text-gray-600 mt-2">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Visual Adoption Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-20"
        >
          <h3 className="text-2xl font-semibold text-center text-gray-900 mb-8">
            Adoption Rate Over Time
          </h3>
          <div className="bg-gray-50 rounded-2xl p-8">
            <div className="relative h-64">
              {/* Traditional CRM Line */}
              <motion.div
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 2, delay: 1 }}
                className="absolute inset-0"
              >
                <svg className="w-full h-full">
                  <path
                    d="M 0 220 Q 100 200 200 180 T 400 160 T 600 140"
                    stroke="#EF4444"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="5,5"
                  />
                  <text x="610" y="145" fill="#EF4444" className="text-sm font-medium">
                    Traditional CRM: 47%
                  </text>
                </svg>
              </motion.div>

              {/* Our Solution Line */}
              <motion.div
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 1, delay: 1.2 }}
                className="absolute inset-0"
              >
                <svg className="w-full h-full">
                  <path
                    d="M 0 220 L 50 20"
                    stroke="#10B981"
                    strokeWidth="3"
                    fill="none"
                  />
                  <line
                    x1="50"
                    y1="20"
                    x2="800"
                    y2="20"
                    stroke="#10B981"
                    strokeWidth="3"
                  />
                  <text x="610" y="15" fill="#10B981" className="text-sm font-medium">
                    SMS CRM: 100%
                  </text>
                </svg>
              </motion.div>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-sm text-gray-500">
                <span>100%</span>
                <span>50%</span>
                <span>0%</span>
              </div>

              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 w-full flex justify-between text-sm text-gray-500 mt-4">
                <span>Day 1</span>
                <span>Week 1</span>
                <span>Month 1</span>
                <span>Month 3</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}