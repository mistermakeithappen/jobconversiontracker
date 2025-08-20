import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionStatus } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    const subscriptionStatus = await getSubscriptionStatus(request);
    
    return NextResponse.json(subscriptionStatus);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return NextResponse.json(
      { 
        hasActiveSubscription: false, 
        error: error instanceof Error ? error.message : 'Failed to check subscription status' 
      },
      { status: 401 }
    );
  }
}
