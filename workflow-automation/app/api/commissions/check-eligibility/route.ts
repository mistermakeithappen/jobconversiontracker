import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { opportunityId, integrationId } = await request.json();

    if (!opportunityId || !integrationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the opportunity's commission eligibility status
    const { data: commissions, error } = await supabase
      .from('opportunity_commissions')
      .select(`
        id,
        ghl_user_id,
        user_name,
        commission_type,
        commission_percentage,
        commission_amount,
        is_eligible_for_payout,
        eligibility_checked_at,
        stage_at_eligibility
      `)
      .eq('opportunity_id', opportunityId)
      .eq('integration_id', integrationId);

    if (error) {
      console.error('Error fetching commission eligibility:', error);
      return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 });
    }

    // Get the integration's completion stages
    const { data: integration } = await supabase
      .from('integrations')
      .select('pipeline_completion_stages')
      .eq('id', integrationId)
      .single();

    const completionStages = integration?.pipeline_completion_stages || {};

    // Calculate total eligible commission amount
    const eligibleCommissions = commissions?.filter(c => c.is_eligible_for_payout) || [];
    const totalEligibleAmount = eligibleCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

    return NextResponse.json({
      commissions: commissions || [],
      eligibleCount: eligibleCommissions.length,
      totalEligibleAmount,
      completionStages,
      hasEligibleCommissions: eligibleCommissions.length > 0
    });

  } catch (error) {
    console.error('Error checking commission eligibility:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}