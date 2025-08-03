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
    const status = searchParams.get('status') || 'active';
    const teamMemberId = searchParams.get('teamMemberId');
    
    // Fetch challenges
    let challengesQuery = supabase
      .from('gamification_challenges')
      .select('*')
      .eq('organization_id', organization.organizationId);
    
    const now = new Date().toISOString();
    
    if (status === 'active') {
      challengesQuery = challengesQuery
        .lte('start_date', now)
        .gte('end_date', now)
        .eq('is_active', true);
    } else if (status === 'upcoming') {
      challengesQuery = challengesQuery
        .gt('start_date', now)
        .eq('is_active', true);
    } else if (status === 'completed') {
      challengesQuery = challengesQuery
        .lt('end_date', now);
    }
    
    const { data: challenges, error: challengesError } = await challengesQuery
      .order('start_date', { ascending: false });
    
    if (challengesError) {
      console.error('Error fetching challenges:', challengesError);
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
    }
    
    // If team member specified, fetch their achievements
    let achievements = [];
    if (teamMemberId && challenges) {
      const challengeIds = challenges.map(c => c.id);
      
      const { data: achievementData } = await supabase
        .from('gamification_achievements')
        .select('*')
        .eq('team_member_id', teamMemberId)
        .in('challenge_id', challengeIds);
      
      achievements = achievementData || [];
    }
    
    // Get all team members for participant info
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name')
      .eq('organization_id', organization.organizationId);
    
    // Enhance challenges with participant info and progress
    const enhancedChallenges = await Promise.all((challenges || []).map(async (challenge) => {
      // Get achievement stats for this challenge
      const { data: challengeAchievements } = await supabase
        .from('gamification_achievements')
        .select('*, team_member:team_members(id, name)')
        .eq('challenge_id', challenge.id);
      
      const participantCount = challengeAchievements?.length || 0;
      const completedCount = challengeAchievements?.filter(a => a.completed_at).length || 0;
      
      // Calculate average progress
      const avgProgress = participantCount > 0
        ? challengeAchievements.reduce((sum, a) => sum + (a.progress_percentage || 0), 0) / participantCount
        : 0;
      
      // Get top performers
      const topPerformers = (challengeAchievements || [])
        .filter(a => a.current_value > 0)
        .sort((a, b) => b.current_value - a.current_value)
        .slice(0, 3)
        .map(a => ({
          teamMemberId: a.team_member_id,
          teamMemberName: a.team_member?.name,
          currentValue: a.current_value,
          progress: a.progress_percentage,
          completed: !!a.completed_at
        }));
      
      // Check if current user is participating (if teamMemberId provided)
      const userAchievement = teamMemberId 
        ? achievements.find(a => a.challenge_id === challenge.id)
        : null;
      
      return {
        ...challenge,
        participantCount,
        completedCount,
        averageProgress: avgProgress,
        topPerformers,
        userParticipation: userAchievement ? {
          isParticipating: true,
          currentValue: userAchievement.current_value,
          progress: userAchievement.progress_percentage,
          completed: !!userAchievement.completed_at,
          rewardEarned: userAchievement.reward_earned
        } : {
          isParticipating: false
        }
      };
    }));
    
    return NextResponse.json({ 
      challenges: enhancedChallenges,
      teamMembers: teamMembers || []
    });
  } catch (error) {
    console.error('Error in GET /api/gamification/challenges:', error);
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
      challengeName,
      challengeType,
      description,
      targetMetric,
      targetValue,
      targetProductIds,
      startDate,
      endDate,
      rewardType,
      rewardValue,
      achievementBadge,
      participantType,
      eligibleTeamMembers,
      isFeatured
    } = body;
    
    // Validate required fields
    if (!challengeName || !challengeType || !targetMetric || !targetValue || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Create challenge
    const { data: challenge, error } = await supabase
      .from('gamification_challenges')
      .insert({
        organization_id: organization.organizationId,
        challenge_name: challengeName,
        challenge_type: challengeType,
        description,
        target_metric: targetMetric,
        target_value: targetValue,
        target_product_ids: targetProductIds || [],
        start_date: startDate,
        end_date: endDate,
        reward_type: rewardType,
        reward_value: rewardValue,
        achievement_badge: achievementBadge,
        participant_type: participantType || 'individual',
        eligible_team_members: eligibleTeamMembers || [],
        is_featured: isFeatured || false,
        created_by: userId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating challenge:', error);
      return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
    }
    
    // Auto-enroll eligible team members if specified
    if (participantType === 'individual' && (!eligibleTeamMembers || eligibleTeamMembers.length === 0)) {
      // Enroll all active team members
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id')
        .eq('organization_id', organization.organizationId)
        .eq('is_active', true);
      
      if (teamMembers && teamMembers.length > 0) {
        const achievements = teamMembers.map(member => ({
          organization_id: organization.organizationId,
          team_member_id: member.id,
          challenge_id: challenge.id,
          achievement_type: challengeType,
          achievement_name: challengeName,
          target_value: targetValue,
          current_value: 0
        }));
        
        await supabase
          .from('gamification_achievements')
          .insert(achievements);
      }
    } else if (eligibleTeamMembers && eligibleTeamMembers.length > 0) {
      // Enroll specific team members
      const achievements = eligibleTeamMembers.map((memberId: string) => ({
        organization_id: organization.organizationId,
        team_member_id: memberId,
        challenge_id: challenge.id,
        achievement_type: challengeType,
        achievement_name: challengeName,
        target_value: targetValue,
        current_value: 0
      }));
      
      await supabase
        .from('gamification_achievements')
        .insert(achievements);
    }
    
    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Error in POST /api/gamification/challenges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Challenge ID required' }, { status: 400 });
    }
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('gamification_challenges')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!existing) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    
    // Update challenge
    const { data: challenge, error } = await supabase
      .from('gamification_challenges')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating challenge:', error);
      return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 });
    }
    
    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Error in PUT /api/gamification/challenges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Join or leave a challenge
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { challengeId, teamMemberId, action } = body;
    
    if (!challengeId || !teamMemberId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: challengeId, teamMemberId, action' 
      }, { status: 400 });
    }
    
    // Verify challenge exists and is active
    const { data: challenge } = await supabase
      .from('gamification_challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    
    if (action === 'join') {
      // Check if already participating
      const { data: existing } = await supabase
        .from('gamification_achievements')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('team_member_id', teamMemberId)
        .single();
      
      if (existing) {
        return NextResponse.json({ 
          error: 'Already participating in this challenge' 
        }, { status: 409 });
      }
      
      // Create achievement record
      const { data: achievement, error } = await supabase
        .from('gamification_achievements')
        .insert({
          organization_id: organization.organizationId,
          team_member_id: teamMemberId,
          challenge_id: challengeId,
          achievement_type: challenge.challenge_type,
          achievement_name: challenge.challenge_name,
          target_value: challenge.target_value,
          current_value: 0
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error joining challenge:', error);
        return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
      }
      
      return NextResponse.json({ achievement });
    } else if (action === 'leave') {
      // Remove achievement record
      const { error } = await supabase
        .from('gamification_achievements')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('team_member_id', teamMemberId);
      
      if (error) {
        console.error('Error leaving challenge:', error);
        return NextResponse.json({ error: 'Failed to leave challenge' }, { status: 500 });
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in PATCH /api/gamification/challenges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}