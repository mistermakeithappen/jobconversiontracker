'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, MessageSquare, CheckCircle, Zap, Shield, Clock } from 'lucide-react';
import Link from 'next/link';

export default function CTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const benefits = [
    { icon: Zap, text: 'Setup in 5 minutes' },
    { icon: Shield, text: 'No credit card required' },
    { icon: Clock, text: '14-day free trial' },
    { icon: CheckCircle, text: 'Cancel anytime' },
  ];

  return (
    <section ref={ref} className="py-24 bg-gradient-to-br from-blue-600 to-purple-600 text-white relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => {
          // Use deterministic values based on index
          const x = ((i * 67) % 1920);
          const y = ((i * 89) % 1080);
          const duration = 10 + (i % 10) * 2;
          const delay = (i % 10);
          
          return (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full"
              initial={{ 
                opacity: 0.1,
                x: x,
                y: y,
              }}
              animate={{
                y: [null, -1000],
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{
                duration: duration,
                repeat: Infinity,
                delay: delay,
                ease: "linear"
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to Give Your Team
            <span className="block mt-2">The Easiest CRM They'll Ever Use?</span>
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-12">
            Join thousands of businesses that switched to SMS-first operations and saw immediate results.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/sign-up"
                className="group px-8 py-4 bg-white text-blue-600 font-semibold rounded-full hover:shadow-2xl transition-all duration-200 flex items-center space-x-3"
              >
                <span className="text-lg">Start Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-blue-600 transition-all duration-200 flex items-center space-x-3">
                <MessageSquare className="w-5 h-5" />
                <span>Text 'DEMO' to (555) 123-4567</span>
              </button>
            </motion.div>
          </div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-6 mb-16"
          >
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="flex items-center space-x-2 text-blue-100"
                >
                  <Icon className="w-5 h-5" />
                  <span>{benefit.text}</span>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-3xl font-bold">2,450+</p>
                <p className="text-blue-100">Active Teams</p>
              </div>
              <div>
                <p className="text-3xl font-bold">98%</p>
                <p className="text-blue-100">Adoption Rate</p>
              </div>
              <div>
                <p className="text-3xl font-bold">4.9/5</p>
                <p className="text-blue-100">User Rating</p>
              </div>
              <div>
                <p className="text-3xl font-bold">&lt; 24h</p>
                <p className="text-blue-100">Setup Time</p>
              </div>
            </div>
          </motion.div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <blockquote className="text-xl italic text-blue-100">
              "We went from chaos to clarity in one day. Our field techs actually use it because 
              it's just texting. Revenue up 23%, stress down 90%."
            </blockquote>
            <cite className="block mt-4 text-white font-medium">
              - Mike Thompson, Thompson Electric (42 employees)
            </cite>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16"
          >
            <p className="text-2xl font-semibold mb-4">
              Your competition is already saving hours every week.
            </p>
            <p className="text-xl text-blue-100">
              Don't let them get ahead. Start your free trial now.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}