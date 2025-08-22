'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { postData } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  Calendar, 
  Crown, 
  Star,
  ArrowRight,
  Sparkles,
  Shield,
  Zap
} from 'lucide-react';

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetch('/api/auth/subscription')
        .then((res) => res.json())
        .then((data) => {
          if (data.subscription) {
            setSubscription(data.subscription);
          }
          setLoading(false);
        });
    }
  }, [user]);



  const redirectToCustomerPortal = async () => {
    try {
      const response = await fetch('/api/auth/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redirect to customer portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to customer portal');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Billing & Subscription
            </h1>
            <p className="text-gray-600 text-lg">Manage your subscription and billing details</p>
          </div>

          {/* Loading Card */}
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Loading Subscription Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                    <div>
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse"></div>
                    <div>
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-12 w-full bg-gradient-to-r from-blue-200 to-purple-200 rounded-xl animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Billing & Subscription
          </h1>
          <p className="text-gray-600 text-lg">Manage your subscription and billing details</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50 mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-800">
                <XCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

            {subscription ? (
          /* Active Subscription UI */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Subscription Card */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="w-8 h-8" />
                      <div>
                        <h2 className="text-2xl font-bold">{subscription.prices?.products?.name || 'Premium Plan'}</h2>
                        <p className="text-blue-100">Your active subscription</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        ${(subscription.prices?.unit_amount / 100).toFixed(2)}
                      </div>
                      <div className="text-blue-100 text-sm">
                        /{subscription.prices?.interval || 'month'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {/* Status */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500 rounded-full">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Subscription Status</h4>
                          <p className="text-sm text-gray-600">Your subscription is working perfectly</p>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-full capitalize">
                    {subscription.status}
                      </div>
                    </div>

                    {/* Next Payment */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-full">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Next Payment</h4>
                          <p className="text-sm text-gray-600">Your next billing cycle</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {subscription.current_period_end ? (
                            new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          ) : (
                            'Loading...'
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {subscription.current_period_end ? (
                            (() => {
                              const daysRemaining = Math.ceil((new Date(subscription.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                              return daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Renewing soon';
                            })()
                          ) : (
                            'Calculating next payment date...'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Manage Billing Button */}
                    <div className="pt-4 space-y-3">
                      <Button 
                        onClick={redirectToCustomerPortal} 
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          Manage Billing & Payment Methods
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Features Sidebar */}
            <div className="space-y-6">
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                   <span className='text-black'>Plan Features</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className='text-black'>Full GHL Integration</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className='text-black'>Advanced Workflows</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className='text-black'>AI-Powered Chatbots</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className='text-black'>Priority Support</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className='text-black'>Advanced Analytics</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Shield className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Protected by Stripe</h4>
                    <p className="text-sm text-gray-600">
                      Your payments are secure and protected by industry-leading encryption.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* No Subscription UI */
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-8 text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Get Started?</h3>
              <p className="text-gray-600">
                Unlock the full potential of our platform with a subscription
              </p>
            </div>
            
            <CardContent className="p-8 text-center">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-3 text-left p-4 bg-blue-50 rounded-lg">
                    <Star className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-semibold text-gray-900">Full GHL Integration</div>
                      <div className="text-sm text-gray-600">Connect and manage your GHL data</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-left p-4 bg-purple-50 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div>
                      <div className="font-semibold text-gray-900">AI-Powered Features</div>
                      <div className="text-sm text-gray-600">Advanced automation and insights</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-left p-4 bg-green-50 rounded-lg">
                    <Shield className="w-5 h-5 text-green-500" />
                    <div>
                      <div className="font-semibold text-gray-900">Priority Support</div>
                      <div className="text-sm text-gray-600">Get help when you need it most</div>
                    </div>
                </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={() => router.push('/pricing')} 
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5" />
                      View Plans & Get Started
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </Button>
                </div>
              </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
} 