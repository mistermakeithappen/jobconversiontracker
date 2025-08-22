'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Building2, TrendingUp, Receipt, Users, Trophy, Calculator, AlertCircle } from 'lucide-react';
import { ComingSoonBadge } from '@/components/ui/ComingSoonBadge';

export default function ForGHLUsersSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const features = [
    {
      icon: TrendingUp,
      title: 'See REAL Profit, Not Just Revenue',
      description: 'GHL shows you $10,000 in revenue. We show you $3,200 in actual profit after materials, labor, and commissions.',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      icon: Receipt,
      title: 'Track Every Expense Without the Hassle',
      description: 'Your team texts receipts. AI matches them to jobs. No more spreadsheets, no more lost receipts.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      hasComingSoon: true,
    },
    {
      icon: Calculator,
      title: 'Automatic Commission Calculations',
      description: 'Set rules once. Commissions calculate automatically. Your team can check their earnings anytime via text.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      hasComingSoon: true,
    },
    {
      icon: Users,
      title: 'Your Team Never Needs to Log Into GHL',
      description: 'They just text. No passwords, no training, no "I forgot how to use it" - just instant adoption.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      hasComingSoon: true,
    },
  ];

  return (
    <section id="for-ghl" ref={ref} className="py-24 bg-gradient-to-br from-orange-50 to-red-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Building2 className="w-4 h-4" />
            <span>For GoHighLevel Users</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Turn GHL Into a Profit-Tracking Powerhouse
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything GHL should have built in. See real profit, not just revenue. Track expenses effortlessly. Calculate commissions automatically.
          </p>
        </motion.div>

        {/* Before/After Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-20"
        >
          <div className="grid md:grid-cols-2 gap-8">
            {/* GHL Alone */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-red-500 text-white p-6">
                <h3 className="text-xl font-semibold flex items-center">
                  <AlertCircle className="w-6 h-6 mr-2" />
                  GHL Alone
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Shows $50,000 in opportunities</p>
                    <p className="text-sm text-gray-600">But is that profit or just revenue?</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">No expense tracking</p>
                    <p className="text-sm text-gray-600">Receipts pile up, profits disappear</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Manual commission calculations</p>
                    <p className="text-sm text-gray-600">Hours of spreadsheet work monthly</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Team needs GHL access</p>
                    <p className="text-sm text-gray-600">More licenses, more training, less adoption</p>
                  </div>
                </div>
              </div>
            </div>

            {/* With Our Platform */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-green-500 text-white p-6">
                <h3 className="text-xl font-semibold flex items-center">
                  <Trophy className="w-6 h-6 mr-2" />
                  GHL + Our Platform
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Shows $18,000 actual profit</p>
                    <p className="text-sm text-gray-600">After all expenses and commissions</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">Automatic expense capture</p>
                      <ComingSoonBadge size="sm" />
                    </div>
                    <p className="text-sm text-gray-600">Team texts receipts, AI does the rest</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900">Real-time commission tracking</p>
                    <p className="text-sm text-gray-600">Everyone knows their earnings instantly</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">Team uses SMS only</p>
                      <ComingSoonBadge size="sm" />
                    </div>
                    <p className="text-sm text-gray-600">100% adoption, zero training needed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className={`w-14 h-14 ${feature.bgColor} rounded-lg flex items-center justify-center mb-6`}>
                  <Icon className={`w-7 h-7 ${feature.color}`} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                  {feature.hasComingSoon && <ComingSoonBadge size="sm" />}
                </div>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Real Example */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-20 bg-white rounded-2xl shadow-xl p-8"
        >
          <h3 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
            Real Example: Johnson Bathroom Remodel
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">What GHL Shows</p>
              <p className="text-4xl font-bold text-gray-900">$8,500</p>
              <p className="text-gray-600">Opportunity Value</p>
            </div>
            
            <div className="text-center border-l border-r border-gray-200">
              <p className="text-sm text-gray-600 mb-2">What We Track</p>
              <div className="space-y-2 text-left max-w-xs mx-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Materials:</span>
                  <span className="text-red-600">-$2,340</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Labor:</span>
                  <span className="text-red-600">-$1,850</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Commission:</span>
                  <span className="text-red-600">-$431</span>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Actual Profit</p>
              <p className="text-4xl font-bold text-green-600">$3,879</p>
              <p className="text-gray-600">45.6% Margin</p>
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-blue-700">
              <span className="font-medium">Without our platform:</span> You think you're making $8,500
              <br />
              <span className="font-medium">With our platform:</span> You know you're making $3,879
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}