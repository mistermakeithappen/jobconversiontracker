'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStripe } from '@/lib/stripe/client';
import { postData } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Session } from '@supabase/supabase-js';
import { Check, ChevronDown, Star, Zap, Users, Shield } from 'lucide-react';
import ForGHLUsersSection from '@/components/landing/ForGHLUsersSection';
import ROISection from '@/components/landing/ROISection';
import CTASection from '@/components/landing/CTASection';
import { motion } from 'framer-motion';

type Price = any;

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  icon: any;
  popular: boolean;
  stripePrice?: any;
}

interface PricingProps {
  products: {
    id: string;
    name: string;
    description: string;
    prices: Price[];
  }[];
  session: Session | null;
}

export default function Pricing({ products, session }: PricingProps) {
  const router = useRouter();
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const { user, loading: isLoading } = useAuth();

  // Fallback plans if no products from database
  const fallbackPlans: Plan[] = [
    {
      id: 'pro',
      name: 'Professional',
      description: 'Complete GHL workflow automation platform',
      price: 47,
      interval: 'month',
      features: [
        'Full GHL Integration',
        'Workflow Automation',
        'Commission Tracking',
        'Sales Pipeline Management',
        'Contact Management',
        'Custom Integrations',
        'Analytics Dashboard',
        'Priority Support'
      ],
      icon: Zap,
      popular: true
    }
  ];

  const displayPlans: Plan[] = products.length > 0 ? products.map((product, index) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.prices[0]?.unit_amount ? product.prices[0].unit_amount / 100 : 47,
    interval: product.prices[0]?.interval || 'month',
    features: [
      'Full GHL Integration',
      'Workflow Automation', 
      'Commission Tracking',
      'Sales Pipeline Management',
      'Contact Management',
      'Custom Integrations',
      'Analytics Dashboard',
      'Priority Support'
    ],
    icon: Zap,
    popular: true,
    stripePrice: product.prices[0]
  })) : fallbackPlans;

  const handleCheckout = async (plan: any) => {
    if (plan.stripePrice) {
      setPriceIdLoading(plan.stripePrice.id);
      if (!user) {
        return router.push('/signin');
      }

      try {
        const { sessionId } = await postData({
          url: '/api/create-checkout-session',
          data: { price: plan.stripePrice },
        });

        const stripe = await getStripe();
        stripe?.redirectToCheckout({ sessionId });
      } catch (error) {
        return alert((error as Error)?.message);
      } finally {
        setPriceIdLoading(undefined);
      }
    } else {
      // For fallback plans, redirect to signup
      router.push('/signup');
    }
  };

  const faqs = [
    {
      question: 'Is there a free trial?',
      answer: 'Yes, we offer a 14-day free trial on all of our plans. No credit card required.',
    },
    {
      question: 'Can I change my plan later?',
      answer: 'Absolutely! You can upgrade, downgrade, or cancel your plan at any time from your account settings.',
    },
    {
      question: 'What is your refund policy?',
      answer: 'We offer a 30-day money-back guarantee. If you are not satisfied with our service, we will refund your payment.',
    },
    {
      question: 'Do you integrate with GoHighLevel?',
      answer: 'Yes! We have deep integration with GoHighLevel, allowing you to manage your CRM through simple text messages.',
    }
  ];

  return (
    <>
      <section className="relative bg-gradient-to-br from-slate-50 to-blue-50 dark:bg-gray-900 overflow-hidden min-h-screen">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => {
            const startX = ((i * 97) % 1920);
            const startY = ((i * 113) % 1080);
            const endX = (((i + 10) * 137) % 1920);
            const endY = (((i + 10) * 149) % 1080);
            const duration = 10 + (i % 10) * 2;
            
            return (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-20"
                initial={{ x: startX, y: startY }}
                animate={{ x: endX, y: endY }}
                transition={{ duration, repeat: Infinity, repeatType: "reverse" }}
              />
            );
          })}
        </div>

        <div className="relative z-10 py-16 px-4 mx-auto max-w-screen-xl lg:py-24 lg:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-screen-md text-center mb-16"
          >
            <h1 className="mb-6 text-5xl md:text-7xl tracking-tight font-extrabold text-gray-900 dark:text-white">
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                One Plan
              </span>
              <span className="block text-black  text-4xl md:text-5xl mt-2 font-bold">
                Everything You Need
              </span>
            </h1>
            <p className="mb-8 text-xl md:text-2xl font-light text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Complete GHL workflow automation platform. No tiers, no limits, just everything you need to succeed.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="flex justify-center max-w-4xl mx-auto">
            {displayPlans.map((plan, index) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative max-w-lg w-full"
                >
                  
                  <Card className="h-full flex flex-col rounded-3xl shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white">
                    <CardHeader className="text-center p-10 pb-6">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                      <CardTitle className="text-3xl font-bold text-gray-900">{plan.name}</CardTitle>
                      <CardDescription className="text-gray-600 mt-3 text-lg">{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-grow p-10 pt-6">
                      <div className="text-center mb-10">
                        <div className="flex items-baseline justify-center">
                          <span className="text-6xl font-extrabold text-gray-900">
                            ${plan.price}
                          </span>
                          <span className="text-2xl text-gray-500 ml-2">/{plan.interval}</span>
                        </div>
                      </div>

                      <ul className="space-y-5">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-center space-x-4">
                            <Check className="w-6 h-6 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700 text-lg">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter className="p-10 pt-6">
                      <Button
                        onClick={() => handleCheckout(plan)}
                        disabled={isLoading}
                        className="w-full text-xl py-6 rounded-2xl font-semibold transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-105"
                      >
                        {priceIdLoading === plan.stripePrice?.id ? 'Loading...' : 'Get Started Now'}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-center"
          >
            <p className="text-gray-600 mb-6">Trusted by thousands of businesses</p>
            <div className="flex items-center justify-center space-x-8 text-gray-400">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-500" />
                <span>30-day money back</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-500" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <ForGHLUsersSection />
      <ROISection />
      
      {/* FAQ Section */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Everything you need to know about our pricing and plans
            </p>
          </motion.div>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <FAQItem question={faq.question} answer={faq.answer} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-lg font-semibold text-left text-gray-900 dark:text-white"
      >
        <span>{question}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  );
} 