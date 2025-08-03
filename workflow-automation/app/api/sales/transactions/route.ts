import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const integrationId = searchParams.get('integrationId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const contactId = searchParams.get('contactId');
    const opportunityId = searchParams.get('opportunityId');

    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        ghl_products (
          id,
          name,
          price,
          price_type,
          currency
        )
      `)
      .eq('organization_id', organization.organizationId);

    if (integrationId) {
      query = query.eq('integration_id', integrationId);
    }
    if (status) {
      query = query.eq('payment_status', status);
    }
    if (startDate) {
      query = query.gte('payment_date', startDate);
    }
    if (endDate) {
      query = query.lte('payment_date', endDate);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }

    const { data: transactions, error } = await query
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Calculate summary statistics
    const summary = {
      total: transactions?.length || 0,
      totalAmount: transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      completedCount: transactions?.filter(t => t.payment_status === 'completed').length || 0,
      completedAmount: transactions?.filter(t => t.payment_status === 'completed')
        .reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      pendingCount: transactions?.filter(t => t.payment_status === 'pending').length || 0,
      failedCount: transactions?.filter(t => t.payment_status === 'failed').length || 0,
      refundedAmount: transactions?.filter(t => t.payment_status === 'refunded')
        .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0
    };

    return NextResponse.json({ 
      transactions: transactions || [],
      summary 
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually create a transaction
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const transactionData = await request.json();

    // Validate required fields
    const required = ['integration_id', 'opportunity_id', 'contact_id', 'amount', 'payment_date'];
    for (const field of required) {
      if (!transactionData[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Create transaction
    const { data: transaction, error } = await supabase
      .from('sales_transactions')
      .insert({
        user_id: user.userId,
        ...transactionData,
        payment_status: transactionData.payment_status || 'completed',
        transaction_type: transactionData.transaction_type || 'sale',
        currency: transactionData.currency || 'USD',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    // Calculate commissions if needed
    if (transaction.opportunity_id && transaction.opportunity_id !== 'direct-sale') {
      // Get commission assignments for this opportunity
      const { data: commissionAssignments } = await supabase
        .from('opportunity_commissions')
        .select('*')
        .eq('opportunity_id', transaction.opportunity_id)
        .eq('user_id', user.userId);

      if (commissionAssignments && commissionAssignments.length > 0) {
        // Calculate commissions for each assignment
        for (const assignment of commissionAssignments) {
          let commissionAmount = 0;
          
          if (assignment.commission_type === 'gross') {
            commissionAmount = transaction.amount * (assignment.commission_percentage / 100);
          } else if (assignment.commission_type === 'custom') {
            commissionAmount = assignment.commission_amount || 0;
          }

          await supabase
            .from('commission_calculations')
            .insert({
              user_id: user.userId,
              transaction_id: transaction.id,
              opportunity_id: transaction.opportunity_id,
              ghl_user_id: assignment.ghl_user_id,
              commission_type: assignment.commission_type,
              commission_percentage: assignment.commission_percentage,
              base_amount: transaction.amount,
              commission_amount: commissionAmount,
              status: 'pending',
              created_at: new Date().toISOString()
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}