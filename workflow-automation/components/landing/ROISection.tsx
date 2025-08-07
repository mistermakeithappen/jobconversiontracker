'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Calculator, TrendingUp, Clock, Users, DollarSign, Percent } from 'lucide-react';

export default function ROISection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  
  // Calculator inputs
  const [teamSize, setTeamSize] = useState(10);
  const [avgRevenue, setAvgRevenue] = useState(50000);
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [avgExpensePerJob, setAvgExpensePerJob] = useState(500);
  
  // Calculate ROI
  const hoursSavedPerMonth = hoursPerWeek * 4;
  const hourValue = 50; // Average hourly rate
  const timeSavings = hoursSavedPerMonth * hourValue * teamSize;
  
  const profitVisibility = avgRevenue * 0.15; // 15% average increase from better visibility
  const expenseReduction = avgExpensePerJob * 20 * 0.10; // 10% reduction on 20 jobs/month
  
  const totalMonthlySavings = timeSavings + profitVisibility + expenseReduction;
  const annualROI = totalMonthlySavings * 12;
  const monthlyPrice = 299; // Example pricing
  const roi = ((totalMonthlySavings - monthlyPrice) / monthlyPrice * 100).toFixed(0);

  return (
    <section ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Calculator className="w-4 h-4" />
            <span>ROI Calculator</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            See Your Return in Real Numbers
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Calculate how much time and money you'll save with our SMS-first approach
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Calculator Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">Your Business Details</h3>
            
            <div className="space-y-6">
              {/* Team Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Size
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-16 text-right font-semibold text-gray-900">{teamSize}</span>
                </div>
              </div>

              {/* Average Monthly Revenue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Revenue
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-500">$</span>
                  <input
                    type="number"
                    value={avgRevenue}
                    onChange={(e) => setAvgRevenue(Number(e.target.value))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Hours Spent on Admin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hours Per Week on Admin Tasks (per person)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-16 text-right font-semibold text-gray-900">{hoursPerWeek}h</span>
                </div>
              </div>

              {/* Average Expense Per Job */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Average Expenses Per Job
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-500">$</span>
                  <input
                    type="number"
                    value={avgExpensePerJob}
                    onChange={(e) => setAvgExpensePerJob(Number(e.target.value))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Industry Average:</span> Businesses spend 15-20% of revenue on administrative tasks that could be automated.
              </p>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Monthly Savings Breakdown */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Monthly Savings Breakdown</h3>
              
              <div className="space-y-4">
                <motion.div 
                  className="flex items-center justify-between p-4 bg-green-50 rounded-lg"
                  initial={{ scale: 0.9 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center space-x-3">
                    <Clock className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Time Saved</p>
                      <p className="text-sm text-gray-600">{hoursSavedPerMonth * teamSize} hours/month</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-green-600">+${timeSavings.toLocaleString()}</p>
                </motion.div>

                <motion.div 
                  className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                  initial={{ scale: 0.9 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.7 }}
                >
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Profit Visibility</p>
                      <p className="text-sm text-gray-600">15% increase from insights</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-blue-600">+${profitVisibility.toLocaleString()}</p>
                </motion.div>

                <motion.div 
                  className="flex items-center justify-between p-4 bg-purple-50 rounded-lg"
                  initial={{ scale: 0.9 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ delay: 0.8 }}
                >
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Expense Reduction</p>
                      <p className="text-sm text-gray-600">Better tracking = less waste</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-purple-600">+${expenseReduction.toLocaleString()}</p>
                </motion.div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-medium text-gray-900">Total Monthly Value</p>
                  <p className="text-2xl font-bold text-gray-900">${totalMonthlySavings.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-600">Platform Cost</p>
                  <p className="text-lg text-gray-600">-${monthlyPrice}</p>
                </div>
              </div>
            </div>

            {/* ROI Summary */}
            <motion.div 
              className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-white"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.9 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold">Your ROI</h3>
                <Percent className="w-8 h-8 opacity-50" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-green-100">Monthly ROI</p>
                  <p className="text-4xl font-bold">{roi}%</p>
                </div>
                
                <div className="pt-4 border-t border-green-400">
                  <p className="text-green-100">Annual Savings</p>
                  <p className="text-3xl font-bold">${annualROI.toLocaleString()}</p>
                </div>
                
                <div className="pt-4">
                  <p className="text-sm text-green-100">
                    That's {(annualROI / monthlyPrice / 12).toFixed(1)}x your investment returned every year
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Testimonial */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 1 }}
              className="bg-white rounded-lg p-6 shadow-md"
            >
              <p className="text-gray-600 italic">
                "We saved 20 hours per week and increased our profit margins by 23% in the first month. 
                The ROI was immediate."
              </p>
              <p className="text-sm text-gray-900 font-medium mt-3">
                - Sarah Johnson, Johnson Construction
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}