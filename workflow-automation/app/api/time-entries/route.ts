import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get('opportunityId');
    
    if (!opportunityId) {
      return NextResponse.json({ error: 'Opportunity ID is required' }, { status: 400 });
    }
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const { data: timeEntries, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        team_member:team_members (
          id,
          full_name,
          email,
          external_id
        )
      `)
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', organization.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching time entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format the time entries for frontend
    const formattedEntries = (timeEntries || []).map(entry => ({
      id: entry.id,
      opportunity_id: entry.opportunity_id,
      user_id: entry.team_member?.external_id || '',
      user_name: entry.team_member?.full_name || 'Unknown',
      user_email: entry.team_member?.email || '',
      hours: entry.hours_worked,
      hourly_rate: entry.hourly_rate || 0,
      description: entry.description || '',
      work_date: entry.date,
      total_amount: entry.total_amount || 0,
      is_billable: entry.is_billable,
      approval_status: entry.approval_status,
      created_at: entry.created_at
    }));

    return NextResponse.json({ timeEntries: formattedEntries });

  } catch (error) {
    console.error('Error in time entries GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const body = await request.json();
    
    const {
      opportunityId,
      integrationId,
      user_id: ghl_user_id,
      user_name,
      user_email,
      hours,
      hourly_rate,
      description,
      work_date
    } = body;

    if (!opportunityId || !ghl_user_id || !hours || !work_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: opportunityId, user_id, hours, work_date' 
      }, { status: 400 });
    }

    // First, find or create the team member
    let { data: teamMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('external_id', ghl_user_id)
      .single();
    
    if (!teamMember) {
      // Create team member if doesn't exist
      const { data: newTeamMember, error: teamError } = await supabase
        .from('team_members')
        .insert({
          organization_id: organization.organizationId,
          external_id: ghl_user_id,
          email: user_email || 'unknown@example.com',
          full_name: user_name || 'Unknown User',
          is_active: true
        })
        .select()
        .single();
        
      if (teamError) {
        console.error('Error creating team member:', teamError);
        return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
      }
      
      teamMember = newTeamMember;
    }

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .insert({
        organization_id: organization.organizationId,
        opportunity_id: opportunityId,
        team_member_id: teamMember.id,
        date: work_date,
        hours_worked: parseFloat(hours),
        hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
        description,
        work_type: 'General', // Default work type
        is_billable: true,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ timeEntry });

  } catch (error) {
    console.error('Error in time entries POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const {
      id,
      user_id: ghl_user_id,
      user_name,
      user_email,
      hours,
      hourly_rate,
      description,
      work_date
    } = body;

    if (!id || !hours || !work_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, hours, work_date' 
      }, { status: 400 });
    }

    // If user changed, need to find/create the new team member
    let teamMemberId = null;
    if (ghl_user_id) {
      let { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('organization_id', organization.organizationId)
        .eq('external_id', ghl_user_id)
        .single();
      
      if (!teamMember && user_name) {
        // Create team member if doesn't exist
        const { data: newTeamMember, error: teamError } = await supabase
          .from('team_members')
          .insert({
            organization_id: organization.organizationId,
            external_id: ghl_user_id,
            email: user_email || 'unknown@example.com',
            full_name: user_name || 'Unknown User',
            is_active: true
          })
          .select()
          .single();
          
        if (!teamError && newTeamMember) {
          teamMemberId = newTeamMember.id;
        }
      } else if (teamMember) {
        teamMemberId = teamMember.id;
      }
    }

    // Build update object with correct field names
    const updateData: any = {
      date: work_date,
      hours_worked: parseFloat(hours),
      description: description || null,
      updated_at: new Date().toISOString()
    };
    
    if (hourly_rate !== undefined) {
      updateData.hourly_rate = hourly_rate ? parseFloat(hourly_rate) : null;
    }
    
    if (teamMemberId) {
      updateData.team_member_id = teamMemberId;
    }

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ timeEntry });

  } catch (error) {
    console.error('Error in time entries PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Time entry ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting time entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in time entries DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}