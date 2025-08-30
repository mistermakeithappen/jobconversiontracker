import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ 
        error: 'No organization found'
      }, { status: 404 });
    }

    const body = await request.json();
    const { full_name, email, phone, external_id } = body;

    if (!full_name || !email) {
      return NextResponse.json({ 
        error: 'Name and email are required'
      }, { status: 400 });
    }

    // Create team member
    const { data: teamMember, error } = await supabase
      .from('team_members')
      .insert({
        organization_id: organization.organizationId,
        full_name,
        email,
        phone: phone || null,
        external_id: external_id || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating team member:', error);
      return NextResponse.json({ 
        error: 'Failed to create team member'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      teamMember
    });

  } catch (error) {
    console.error('Error in create team-member API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}