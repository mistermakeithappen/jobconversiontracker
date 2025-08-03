import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const teamMemberId = searchParams.get('teamMemberId');
    const productId = searchParams.get('productId');
    const subscriptionId = searchParams.get('subscriptionId');
    
    let query = supabase
      .from('recurring_commission_tracking')
      .select(`
        *,
        commission_record:commission_records!commission_record_id(
          *,
          team_member:team_members(*)
        ),
        product:ghl_products(*)
      `)
      .eq('organization_id', organization.organizationId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (teamMemberId) {
      query = query.eq('commission_record.team_member_id', teamMemberId);
    }
    
    if (productId) {
      query = query.eq('product_id', productId);
    }
    
    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId);
    }
    
    const { data: trackingRecords, error } = await query
      .order('period_start', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching recurring commission tracking:', error);
      return NextResponse.json({ error: 'Failed to fetch recurring commissions' }, { status: 500 });
    }
    
    // Calculate summary statistics
    const stats = {
      totalScheduled: 0,
      totalPending: 0,
      totalEarned: 0,
      totalPaid: 0,
      upcomingCount: 0,
      activeSubscriptions: new Set()
    };
    
    trackingRecords?.forEach(record => {
      stats.activeSubscriptions.add(record.subscription_id);
      
      switch (record.status) {
        case 'scheduled':
          stats.totalScheduled += record.commission_amount;
          stats.upcomingCount++;
          break;
        case 'pending':
          stats.totalPending += record.commission_amount;
          break;
        case 'earned':
          stats.totalEarned += record.commission_amount;
          break;
        case 'paid':
          stats.totalPaid += record.commission_amount;
          break;
      }
    });
    
    return NextResponse.json({ 
      trackingRecords: trackingRecords || [],
      stats: {
        ...stats,
        activeSubscriptions: stats.activeSubscriptions.size
      }
    });
  } catch (error) {
    console.error('Error in GET /api/commissions/recurring:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    const {
      eventType,
      subscriptionId,
      productId,
      contactId,
      amount,
      periodStart,
      periodEnd,
      assignmentId
    } = body;
    
    if (!subscriptionId || !productId || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields: subscriptionId, productId, amount' 
      }, { status: 400 });
    }
    
    // Get product commission rules
    const { data: productRule } = await supabase
      .from('commission_product_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('organization_id', organization.organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();
    
    if (!productRule) {
      return NextResponse.json({ 
        error: 'No active commission rule found for this product' 
      }, { status: 404 });
    }
    
    // Check subscription lifecycle
    const { data: lifecycleEvents } = await supabase
      .from('subscription_lifecycle')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .eq('organization_id', organization.organizationId)
      .order('event_date', { ascending: false });
    
    const lastEvent = lifecycleEvents?.[0];
    const periodNumber = lifecycleEvents?.filter(e => e.event_type === 'renewed').length + 1 || 1;
    
    // Calculate commission based on period
    let commissionRate = productRule.initial_sale_rate;
    let trackingType = 'initial';
    
    if (periodNumber > 1) {
      if (productRule.mrr_commission_type === 'first_payment_only') {
        return NextResponse.json({ 
          message: 'No commission for renewals - first payment only rule' 
        }, { status: 200 });
      }
      
      if (productRule.mrr_commission_type === 'duration' && 
          periodNumber > productRule.mrr_duration_months) {
        return NextResponse.json({ 
          message: 'Commission duration exceeded' 
        }, { status: 200 });
      }
      
      if (productRule.mrr_commission_type === 'trailing' && 
          periodNumber > productRule.mrr_duration_months + productRule.trailing_months) {
        return NextResponse.json({ 
          message: 'Trailing commission period exceeded' 
        }, { status: 200 });
      }
      
      if (productRule.mrr_commission_type === 'trailing' && 
          periodNumber > productRule.mrr_duration_months) {
        commissionRate = productRule.renewal_rate * 0.5; // Reduced rate for trailing
        trackingType = 'trailing';
      } else {
        commissionRate = productRule.renewal_rate;
        trackingType = 'renewal';
      }
    }
    
    const commissionAmount = amount * (commissionRate / 100);
    
    // Create commission event
    const { data: event, error: eventError } = await supabase
      .from('commission_events')
      .insert({
        organization_id: organization.organizationId,
        event_source: 'subscription',
        event_type: eventType || 'subscription_payment',
        opportunity_id: null, // Could be linked if we have it
        contact_id: contactId,
        product_id: productId,
        subscription_id: subscriptionId,
        event_amount: amount,
        event_data: {
          period_number: periodNumber,
          period_start: periodStart,
          period_end: periodEnd
        }
      })
      .select()
      .single();
    
    if (eventError) {
      console.error('Error creating commission event:', eventError);
      return NextResponse.json({ error: 'Failed to create commission event' }, { status: 500 });
    }
    
    // Get or create commission assignment
    let assignment;
    if (assignmentId) {
      const { data } = await supabase
        .from('commission_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
      assignment = data;
    } else {
      // Find assignment for this subscription/product
      const { data } = await supabase
        .from('commission_assignments')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .eq('product_id', productId)
        .eq('is_active', true)
        .limit(1)
        .single();
      assignment = data;
    }
    
    if (!assignment) {
      return NextResponse.json({ 
        error: 'No commission assignment found for this product' 
      }, { status: 404 });
    }
    
    // Create commission record
    const { data: commissionRecord, error: recordError } = await supabase
      .from('commission_records')
      .insert({
        organization_id: organization.organizationId,
        event_id: event.id,
        assignment_id: assignment.id,
        team_member_id: assignment.team_member_id,
        ghl_user_id: assignment.ghl_user_id,
        user_name: assignment.user_name,
        user_email: assignment.user_email,
        base_amount: amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        calculation_method: `${trackingType}_subscription`,
        calculation_details: {
          period_number: periodNumber,
          tracking_type: trackingType,
          product_rule_id: productRule.id
        },
        status: 'pending'
      })
      .select()
      .single();
    
    if (recordError) {
      console.error('Error creating commission record:', recordError);
      return NextResponse.json({ error: 'Failed to create commission record' }, { status: 500 });
    }
    
    // Create recurring tracking record
    const { data: tracking, error: trackingError } = await supabase
      .from('recurring_commission_tracking')
      .insert({
        organization_id: organization.organizationId,
        commission_record_id: commissionRecord.id,
        product_id: productId,
        subscription_id: subscriptionId,
        tracking_type: trackingType,
        period_start: periodStart || new Date().toISOString().split('T')[0],
        period_end: periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period_number: periodNumber,
        base_amount: amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        status: 'pending'
      })
      .select()
      .single();
    
    if (trackingError) {
      console.error('Error creating recurring tracking:', trackingError);
      return NextResponse.json({ error: 'Failed to create recurring tracking' }, { status: 500 });
    }
    
    // Record subscription lifecycle event
    await supabase
      .from('subscription_lifecycle')
      .insert({
        organization_id: organization.organizationId,
        subscription_id: subscriptionId,
        product_id: productId,
        contact_id: contactId,
        event_type: eventType === 'subscription_created' ? 'created' : 'renewed',
        event_date: new Date().toISOString(),
        mrr_amount: amount,
        commission_impact: 'new_commission'
      });
    
    return NextResponse.json({ 
      tracking,
      commissionRecord,
      event
    });
  } catch (error) {
    console.error('Error in POST /api/commissions/recurring:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update recurring commission status
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    const { id, status, earnedDate } = body;
    
    if (!id || !status) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, status' 
      }, { status: 400 });
    }
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('recurring_commission_tracking')
      .select('*, commission_record:commission_records!commission_record_id(*)')
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!existing) {
      return NextResponse.json({ error: 'Recurring commission not found' }, { status: 404 });
    }
    
    // Update tracking record
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'earned' && earnedDate) {
      updateData.earned_date = earnedDate;
    }
    
    const { data: tracking, error } = await supabase
      .from('recurring_commission_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating recurring tracking:', error);
      return NextResponse.json({ error: 'Failed to update recurring tracking' }, { status: 500 });
    }
    
    // Update associated commission record status if needed
    if (status === 'earned' || status === 'paid') {
      await supabase
        .from('commission_records')
        .update({
          status: status === 'earned' ? 'approved' : 'paid',
          approved_at: status === 'earned' ? new Date().toISOString() : undefined,
          paid_at: status === 'paid' ? new Date().toISOString() : undefined,
          is_due_for_payout: status === 'earned',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.commission_record_id);
    }
    
    return NextResponse.json({ tracking });
  } catch (error) {
    console.error('Error in PATCH /api/commissions/recurring:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}