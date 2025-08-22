'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

export interface SubscriptionData {
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  trialEnded?: boolean;
  loading: boolean;
  error?: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    hasActiveSubscription: false,
    loading: true
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionData({
        hasActiveSubscription: false,
        loading: false,
        error: 'User not authenticated'
      });
      return;
    }

    try {
      const response = await fetch('/api/auth/subscription', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.subscription) {
        setSubscriptionData({
          hasActiveSubscription: true,
          subscriptionStatus: data.subscription.status,
          loading: false
        });
      } else {
        // Check organization-level subscription as fallback
        const orgResponse = await fetch('/api/auth/me-simple', {
          credentials: 'include'
        });
        
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          const org = orgData.organization;
          
          if (org) {
            const now = new Date();
            const trialEndDate = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
            const trialEnded = trialEndDate ? now > trialEndDate : false;
            
            setSubscriptionData({
              hasActiveSubscription: org.subscription_status === 'active' || (org.subscription_status === 'trial' && !trialEnded),
              subscriptionStatus: org.subscription_status,
              subscriptionPlan: org.subscription_plan,
              trialEnded,
              loading: false
            });
          } else {
            setSubscriptionData({
              hasActiveSubscription: false,
              subscriptionStatus: 'inactive',
              loading: false
            });
          }
        } else {
          setSubscriptionData({
            hasActiveSubscription: false,
            subscriptionStatus: 'inactive',
            loading: false
          });
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionData({
        hasActiveSubscription: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check subscription'
      });
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const refreshSubscription = useCallback(() => {
    setSubscriptionData(prev => ({ ...prev, loading: true }));
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...subscriptionData,
    refreshSubscription
  };
}
