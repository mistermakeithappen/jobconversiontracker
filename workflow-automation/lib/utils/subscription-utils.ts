import { NextRequest } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  trialEnded?: boolean;
  subscriptionPlan?: string;
  error?: string;
}

/**
 * Check if a user has an active subscription
 * @param userId - The user ID to check
 * @returns SubscriptionStatus object with subscription details
 */
export async function checkUserSubscription(userId: string): Promise<SubscriptionStatus> {
  const supabase = getServiceSupabase();
  
  try {
    // Check for active subscription in Stripe subscriptions table
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Error checking subscription:', subscriptionError);
      return {
        hasActiveSubscription: false,
        error: 'Failed to check subscription status'
      };
    }

    // If user has active Stripe subscription
    if (subscription) {
      return {
        hasActiveSubscription: true,
        subscriptionStatus: subscription.status
      };
    }

    // Fallback: Check organization-level subscription if no Stripe subscription found
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        organizations!inner(
          subscription_status,
          subscription_plan,
          trial_ends_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (orgError && orgError.code !== 'PGRST116') {
      console.error('Error checking organization subscription:', orgError);
    }

    if (orgMember?.organizations && orgMember.organizations.length > 0) {
      const org = orgMember.organizations[0] as any;
      const now = new Date();
      const trialEndDate = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
      const trialEnded = trialEndDate ? now > trialEndDate : false;

      return {
        hasActiveSubscription: org.subscription_status === 'active' || (org.subscription_status === 'trial' && !trialEnded),
        subscriptionStatus: org.subscription_status,
        subscriptionPlan: org.subscription_plan,
        trialEnded
      };
    }

    return {
      hasActiveSubscription: false,
      subscriptionStatus: 'inactive'
    };
  } catch (error) {
    console.error('Error in checkUserSubscription:', error);
    return {
      hasActiveSubscription: false,
      error: 'Failed to check subscription status'
    };
  }
}

/**
 * Middleware function to require active subscription for API routes
 * @param request - NextRequest object
 * @returns Object with userId and subscription status, or throws error
 */
export async function requireSubscription(request: NextRequest) {
  const { userId } = await requireAuth(request);
  const subscriptionStatus = await checkUserSubscription(userId);
  
  if (!subscriptionStatus.hasActiveSubscription) {
    throw new Error('Active subscription required to access GHL services');
  }
  
  return { userId, subscriptionStatus };
}

/**
 * Get subscription status for frontend usage
 * @param request - NextRequest object
 * @returns Subscription status object with user info
 */
export async function getSubscriptionStatus(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const subscriptionStatus = await checkUserSubscription(userId);
    
    return {
      userId,
      ...subscriptionStatus
    };
  } catch (error) {
    return {
      hasActiveSubscription: false,
      error: error instanceof Error ? error.message : 'Authentication required'
    };
  }
}
