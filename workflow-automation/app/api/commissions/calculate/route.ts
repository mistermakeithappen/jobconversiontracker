import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAuthWithOrg, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { transactionId, commissionAssignments } = await request.json();

    if (!transactionId || !commissionAssignments || !Array.isArray(commissionAssignments)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('sales_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Get opportunity details for profit calculation if needed
    let opportunityData = null;
    if (transaction.opportunity_id && transaction.opportunity_id !== 'direct-sale') {
      const { data: opportunity } = await supabase
        .from('opportunity_cache')
        .select('revenue, total_expenses')
        .eq('opportunity_id', transaction.opportunity_id)
        .single();
      
      opportunityData = opportunity;
    }

    // Calculate and create commission records
    const calculatedCommissions = [];
    
    for (const assignment of commissionAssignments) {
      let baseAmount = transaction.amount;
      let commissionAmount = 0;
      let profitAmount = null;
      let expenseAmount = null;
      
      switch (assignment.commission_type) {
        case 'gross':
          // Commission based on gross sale amount
          commissionAmount = baseAmount * (assignment.commission_percentage / 100);
          break;
          
        case 'profit':
          // Commission based on profit (revenue - expenses)
          if (opportunityData) {
            expenseAmount = opportunityData.total_expenses || 0;
            profitAmount = (opportunityData.revenue || transaction.amount) - expenseAmount;
            baseAmount = profitAmount;
            commissionAmount = baseAmount * (assignment.commission_percentage / 100);
          } else {
            // If no opportunity data, treat as gross
            commissionAmount = baseAmount * (assignment.commission_percentage / 100);
          }
          break;
          
        case 'tiered':
          // Tiered commission based on total sales volume
          // This would require fetching total sales for the period
          commissionAmount = await calculateTieredCommission(
            supabase,
            organization.organizationId,
            assignment.ghl_user_id,
            baseAmount,
            assignment.commission_tiers
          );
          break;
          
        case 'flat':
          // Flat commission amount
          commissionAmount = assignment.commission_amount || 0;
          break;
          
        case 'hybrid':
          // Base + percentage
          const baseCommission = assignment.base_commission || 0;
          const percentageCommission = baseAmount * ((assignment.commission_percentage || 0) / 100);
          commissionAmount = baseCommission + percentageCommission;
          break;
      }

      const calculationData = {
        organization_id: organization.organizationId,
        transaction_id: transaction.id,
        opportunity_id: transaction.opportunity_id,
        team_member_id: assignment.team_member_id || null,
        commission_type: assignment.commission_type,
        commission_percentage: assignment.commission_percentage,
        commission_tier: assignment.commission_tier,
        base_amount: baseAmount,
        commission_amount: commissionAmount,
        revenue_amount: transaction.amount,
        expense_amount: expenseAmount,
        profit_amount: profitAmount,
        status: 'pending',
        requires_payment_verification: transaction.transaction_type.includes('subscription'),
        created_at: new Date().toISOString()
      };

      const { data: commission, error: commissionError } = await supabase
        .from('commission_calculations')
        .insert(calculationData)
        .select()
        .single();

      if (commissionError) {
        console.error('Error creating commission:', commissionError);
        continue;
      }

      calculatedCommissions.push(commission);
    }

    return NextResponse.json({
      success: true,
      commissions: calculatedCommissions,
      summary: {
        transactionAmount: transaction.amount,
        totalCommissions: calculatedCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
        count: calculatedCommissions.length
      }
    });

  } catch (error) {
    console.error('Commission calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch commission calculations
export async function GET(request: NextRequest) {
  try {
    const { userId, user, organization } = await requireAuthWithOrg(request);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const opportunityId = searchParams.get('opportunityId');
    const ghlUserId = searchParams.get('ghlUserId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('commission_calculations')
      .select(`
        *,
        sales_transactions (
          amount,
          payment_date,
          contact_id,
          product_id,
          transaction_type
        )
      `)
      .eq('organization_id', organization.organizationId);

    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }
    if (ghlUserId) {
      query = query.eq('team_member_id', ghlUserId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: commissions, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commissions:', error);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }

    return NextResponse.json({ commissions: commissions || [] });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate tiered commission
async function calculateTieredCommission(
  supabase: any,
  organizationId: string,
  teamMemberId: string,
  saleAmount: number,
  tiers: any[]
): Promise<number> {
  // Get total sales for the current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: transactions } = await supabase
    .from('sales_transactions')
    .select('amount')
    .eq('organization_id', organizationId)
    .gte('payment_date', startOfMonth.toISOString())
    .eq('payment_status', 'completed')
    .in('id', 
      supabase
        .from('commission_calculations')
        .select('transaction_id')
        .eq('team_member_id', teamMemberId)
    );

  const totalSales = (transactions || []).reduce((sum: number, t: any) => sum + t.amount, 0) + saleAmount;

  // Find applicable tier
  const sortedTiers = (tiers || []).sort((a, b) => a.threshold - b.threshold);
  let applicableTier = sortedTiers[0];
  
  for (const tier of sortedTiers) {
    if (totalSales >= tier.threshold) {
      applicableTier = tier;
    }
  }

  return saleAmount * ((applicableTier?.percentage || 0) / 100);
}