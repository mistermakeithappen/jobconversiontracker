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
    const leaderboardType = searchParams.get('type') || 'monthly';
    const metric = searchParams.get('metric') || 'revenue';
    const challengeId = searchParams.get('challengeId');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Calculate date range based on type
    const now = new Date();
    let startDate: Date;
    let endDate = now;
    
    switch (leaderboardType) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'all_time':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    if (challengeId) {
      // Challenge-specific leaderboard
      const { data: achievements, error } = await supabase
        .from('gamification_achievements')
        .select(`
          *,
          team_member:team_members(*)
        `)
        .eq('challenge_id', challengeId)
        .order('current_value', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching challenge leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
      }
      
      const leaderboard = (achievements || []).map((achievement, index) => ({
        rank: index + 1,
        teamMemberId: achievement.team_member_id,
        teamMember: achievement.team_member,
        score: achievement.current_value,
        progress: achievement.progress_percentage,
        completed: !!achievement.completed_at,
        rewardEarned: achievement.reward_earned,
        metrics: {
          currentValue: achievement.current_value,
          targetValue: achievement.target_value
        }
      }));
      
      return NextResponse.json({
        type: 'challenge',
        challengeId,
        leaderboard,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() }
      });
    } else {
      // General leaderboard based on sales/commissions
      let leaderboardData: any[] = [];
      
      if (metric === 'revenue' || metric === 'units') {
        // Fetch sales data
        const { data: transactions, error } = await supabase
          .from('sales_transactions')
          .select(`
            *,
            team_member:team_members(*)
          `)
          .eq('organization_id', organization.organizationId)
          .eq('payment_status', 'completed')
          .gte('payment_date', startDate.toISOString())
          .lte('payment_date', endDate.toISOString());
        
        if (error) {
          console.error('Error fetching transactions:', error);
          return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
        }
        
        // Aggregate by team member
        const memberStats = new Map();
        
        transactions?.forEach(transaction => {
          if (!transaction.team_member_id) return;
          
          const stats = memberStats.get(transaction.team_member_id) || {
            teamMember: transaction.team_member,
            revenue: 0,
            units: 0,
            transactions: 0,
            productsSold: new Set()
          };
          
          stats.revenue += transaction.amount;
          stats.units += 1;
          stats.transactions += 1;
          if (transaction.product_id) {
            stats.productsSold.add(transaction.product_id);
          }
          
          memberStats.set(transaction.team_member_id, stats);
        });
        
        leaderboardData = Array.from(memberStats.entries())
          .map(([memberId, stats]) => ({
            teamMemberId: memberId,
            teamMember: stats.teamMember,
            score: metric === 'revenue' ? stats.revenue : stats.units,
            metrics: {
              revenue: stats.revenue,
              units: stats.units,
              transactions: stats.transactions,
              uniqueProducts: stats.productsSold.size,
              averageOrderValue: stats.units > 0 ? stats.revenue / stats.units : 0
            }
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else if (metric === 'commissions') {
        // Fetch commission data
        const { data: commissions, error } = await supabase
          .from('commission_records')
          .select(`
            *,
            team_member:team_members(*)
          `)
          .eq('organization_id', organization.organizationId)
          .in('status', ['approved', 'paid'])
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        if (error) {
          console.error('Error fetching commissions:', error);
          return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 });
        }
        
        // Aggregate by team member
        const memberStats = new Map();
        
        commissions?.forEach(commission => {
          if (!commission.team_member_id) return;
          
          const stats = memberStats.get(commission.team_member_id) || {
            teamMember: commission.team_member,
            totalCommissions: 0,
            commissionCount: 0,
            paidCommissions: 0
          };
          
          stats.totalCommissions += commission.commission_amount;
          stats.commissionCount += 1;
          if (commission.status === 'paid') {
            stats.paidCommissions += commission.commission_amount;
          }
          
          memberStats.set(commission.team_member_id, stats);
        });
        
        leaderboardData = Array.from(memberStats.entries())
          .map(([memberId, stats]) => ({
            teamMemberId: memberId,
            teamMember: stats.teamMember,
            score: stats.totalCommissions,
            metrics: {
              totalCommissions: stats.totalCommissions,
              commissionCount: stats.commissionCount,
              paidCommissions: stats.paidCommissions,
              averageCommission: stats.commissionCount > 0 
                ? stats.totalCommissions / stats.commissionCount 
                : 0
            }
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
      
      // Add rankings
      const leaderboard = leaderboardData.map((entry, index) => ({
        rank: index + 1,
        ...entry,
        change: 0 // Could be calculated if we store historical data
      }));
      
      // Store snapshot for historical tracking
      if (leaderboard.length > 0) {
        await supabase
          .from('gamification_leaderboards')
          .insert({
            organization_id: organization.organizationId,
            leaderboard_type: leaderboardType,
            period_start: startDate.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            rankings: leaderboard,
            metric_type: metric,
            total_participants: leaderboard.length
          });
      }
      
      return NextResponse.json({
        type: leaderboardType,
        metric,
        leaderboard,
        dateRange: { 
          start: startDate.toISOString(), 
          end: endDate.toISOString() 
        }
      });
    }
  } catch (error) {
    console.error('Error in GET /api/gamification/leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get achievement progress for a specific team member
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { teamMemberId, challengeId, progressUpdate } = body;
    
    if (!teamMemberId || !challengeId || progressUpdate === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: teamMemberId, challengeId, progressUpdate' 
      }, { status: 400 });
    }
    
    // Get existing achievement
    const { data: achievement, error: fetchError } = await supabase
      .from('gamification_achievements')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .eq('challenge_id', challengeId)
      .single();
    
    if (fetchError || !achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }
    
    // Update progress
    const newValue = achievement.current_value + progressUpdate;
    const updateData: any = {
      current_value: newValue,
      updated_at: new Date().toISOString()
    };
    
    // Check if challenge completed
    if (newValue >= achievement.target_value && !achievement.completed_at) {
      updateData.completed_at = new Date().toISOString();
      
      // Get challenge details for reward calculation
      const { data: challenge } = await supabase
        .from('gamification_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      
      if (challenge && challenge.reward_type && challenge.reward_value) {
        updateData.reward_earned = challenge.reward_value;
      }
    }
    
    // Update achievement
    const { data: updated, error: updateError } = await supabase
      .from('gamification_achievements')
      .update(updateData)
      .eq('id', achievement.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating achievement:', updateError);
      return NextResponse.json({ error: 'Failed to update achievement' }, { status: 500 });
    }
    
    // If completed, create commission bonus if applicable
    if (updated.completed_at && updated.reward_earned > 0) {
      const { data: challenge } = await supabase
        .from('gamification_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      
      if (challenge && challenge.reward_type === 'fixed_bonus') {
        // Create bonus commission event
        const { data: event } = await supabase
          .from('commission_events')
          .insert({
            organization_id: organization.organizationId,
            event_source: 'manual',
            event_type: 'challenge_bonus',
            contact_id: 'challenge_system',
            event_amount: updated.reward_earned,
            event_data: {
              challenge_id: challengeId,
              challenge_name: challenge.challenge_name,
              achievement_id: updated.id
            }
          })
          .select()
          .single();
        
        if (event) {
          // Create commission record
          await supabase
            .from('commission_records')
            .insert({
              organization_id: organization.organizationId,
              event_id: event.id,
              assignment_id: null, // Manual bonus
              team_member_id: teamMemberId,
              base_amount: updated.reward_earned,
              commission_amount: updated.reward_earned,
              calculation_method: 'challenge_bonus',
              calculation_details: {
                challenge_id: challengeId,
                challenge_name: challenge.challenge_name
              },
              status: 'approved',
              approved_at: new Date().toISOString(),
              is_due_for_payout: true
            });
        }
      }
    }
    
    return NextResponse.json({ 
      achievement: updated,
      completed: !!updated.completed_at,
      rewardEarned: updated.reward_earned
    });
  } catch (error) {
    console.error('Error in POST /api/gamification/leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}