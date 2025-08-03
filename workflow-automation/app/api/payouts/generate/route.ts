import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId, user } = await requireAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { 
      ghlUserId, 
      startDate, 
      endDate,
      paymentMethod = 'direct_deposit'
    } = await request.json();

    if (!ghlUserId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get team member from GHL user ID
    const { data: teamMember, error: teamMemberError } = await supabase
      .from('team_members')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('external_id', ghlUserId)
      .single();
      
    if (teamMemberError || !teamMember) {
      console.error('Team member not found:', teamMemberError);
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Get all approved, unpaid commissions for the period
    const { data: commissions, error: commissionsError } = await supabase
      .from('commission_calculations')
      .select(`
        *,
        sales_transactions (
          amount,
          payment_date,
          contact_id,
          opportunity_id,
          product_id,
          transaction_type,
          ghl_products (
            name
          )
        )
      `)
      .eq('organization_id', organization.organizationId)
      .eq('team_member_id', teamMember.id)
      .eq('status', 'approved')
      .is('payout_id', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (commissionsError) {
      console.error('Error fetching commissions:', commissionsError);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }

    if (!commissions || commissions.length === 0) {
      return NextResponse.json({ 
        error: 'No approved commissions found for the specified period' 
      }, { status: 404 });
    }

    // Calculate total commission amount
    const totalAmount = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
    const totalSalesAmount = commissions.reduce((sum, c) => sum + (c.sales_transactions?.amount || 0), 0);

    // Generate payout number
    const { data: payoutNumber } = await supabase
      .rpc('generate_payout_number');

    // Use team member info
    const userName = teamMember.full_name;
    const userEmail = teamMember.email;

    // Create payout record
    const payoutData = {
      organization_id: organization.organizationId,
      team_member_id: teamMember.id,
      user_name: userName,
      user_email: userEmail,
      payout_number: payoutNumber,
      payout_date: new Date().toISOString().split('T')[0],
      payout_period_start: startDate,
      payout_period_end: endDate,
      total_amount: totalAmount,
      currency: 'USD',
      payment_method: paymentMethod,
      payment_status: 'pending',
      commission_count: commissions.length,
      total_sales_amount: totalSalesAmount,
      generated_by: userId,
      created_at: new Date().toISOString()
    };

    const { data: payout, error: payoutError } = await supabase
      .from('commission_payouts')
      .insert(payoutData)
      .select()
      .single();

    if (payoutError) {
      console.error('Error creating payout:', payoutError);
      return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 });
    }

    // Create payout line items and update commissions
    const lineItems = [];
    
    for (const commission of commissions) {
      const transaction = commission.sales_transactions;
      
      const lineItemData = {
        payout_id: payout.id,
        commission_id: commission.id,
        transaction_id: commission.transaction_id,
        opportunity_id: commission.opportunity_id,
        opportunity_name: `Opportunity ${commission.opportunity_id}`, // Replace with actual lookup
        contact_id: transaction?.contact_id || 'unknown',
        contact_name: `Contact ${transaction?.contact_id}`, // Replace with actual lookup
        product_name: transaction?.ghl_products?.name || 'Unknown Product',
        sale_date: transaction?.payment_date || commission.created_at,
        sale_amount: transaction?.amount || 0,
        commission_percentage: commission.commission_percentage,
        commission_amount: commission.commission_amount,
        transaction_type: transaction?.transaction_type || 'sale',
        created_at: new Date().toISOString()
      };

      lineItems.push(lineItemData);
    }

    // Insert line items
    const { error: lineItemsError } = await supabase
      .from('payout_line_items')
      .insert(lineItems);

    if (lineItemsError) {
      console.error('Error creating line items:', lineItemsError);
      // Should rollback payout creation here in production
    }

    // Update commissions with payout ID
    const commissionIds = commissions.map(c => c.id);
    const { error: updateError } = await supabase
      .from('commission_calculations')
      .update({ 
        payout_id: payout.id,
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .in('id', commissionIds);

    if (updateError) {
      console.error('Error updating commissions:', updateError);
    }

    return NextResponse.json({
      success: true,
      payout: {
        ...payout,
        lineItems: lineItems.length,
        commissions: commissions.length
      }
    });

  } catch (error) {
    console.error('Payout generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch payouts
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const ghlUserId = searchParams.get('ghlUserId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('commission_payouts')
      .select(`
        *,
        payout_line_items (count),
        team_members (
          full_name,
          email,
          external_id
        )
      `)
      .eq('organization_id', organization.organizationId);

    if (ghlUserId) {
      // Get team member ID for the GHL user ID
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('organization_id', organization.organizationId)
        .eq('external_id', ghlUserId)
        .single();
        
      if (teamMember) {
        query = query.eq('team_member_id', teamMember.id);
      }
    }
    if (status) {
      query = query.eq('payment_status', status);
    }
    if (startDate) {
      query = query.gte('payout_date', startDate);
    }
    if (endDate) {
      query = query.lte('payout_date', endDate);
    }

    const { data: payouts, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payouts:', error);
      return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
    }

    return NextResponse.json({ payouts: payouts || [] });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}