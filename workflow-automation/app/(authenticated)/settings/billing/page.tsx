'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { postData } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

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
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900">{subscription.prices?.products?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {subscription.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Next Payment</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
                <div className="pt-4">
                  <Button onClick={redirectToCustomerPortal} className="w-full">
                    Manage Billing
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No Subscription Found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  You do not have an active subscription.
                </p>
                <Button onClick={() => router.push('/pricing')} className="mt-6">
                  View Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 