'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Briefcase, MessageSquare, Zap, Settings, Layers } from 'lucide-react';

export default function ForBusinessesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section id="for-business" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Briefcase className="w-4 h-4" />
            <span>For Businesses Seeking Better</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            A CRM That Speaks Your Language
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built for your exact business model. No compromises, no workarounds, no "that's not how our software works."
          </p>
        </motion.div>



        {/* Comparison with Traditional CRMs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gray-50 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-semibold text-center text-gray-900 mb-8">
            Why Traditional CRMs Fail
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Complex Setup</h4>
              <p className="text-gray-600">Weeks of configuration, customization, and compromise</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">One-Size-Fits-None</h4>
              <p className="text-gray-600">Built for everyone, perfect for no one</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Low Adoption</h4>
              <p className="text-gray-600">Too complicated for teams to actually use</p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <h4 className="text-xl font-semibold text-gray-900 mb-4">Our Approach</h4>
            <div className="max-w-2xl mx-auto bg-white rounded-xl p-6 shadow-lg">
              <MessageSquare className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <p className="text-lg text-gray-700">
                <span className="font-semibold">Just text.</span> No setup. No training. No adoption issues.
                <br />
                AI understands your business and handles everything else.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}