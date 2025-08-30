import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const supabase = getServiceSupabase();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ 
        error: 'No organization found',
        members: [] 
      }, { status: 200 });
    }

    // Fetch team members for the organization
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching team members:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch team members',
        members: []
      }, { status: 200 });
    }

    return NextResponse.json({ 
      members: teamMembers || [],
      total: teamMembers?.length || 0
    });

  } catch (error) {
    console.error('Error in team-members API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        members: []
      },
      { status: 200 }
    );
  }
}