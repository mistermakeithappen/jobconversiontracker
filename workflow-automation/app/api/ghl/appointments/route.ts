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
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('ghl_appointments')
      .select(`
        *,
        team_member:team_members!ghl_appointments_team_member_id_fkey(
          id, 
          full_name, 
          email, 
          external_id
        )
      `)
      .eq('organization_id', organization.organizationId)
      .order('start_time', { ascending: true });

    if (calendarId) {
      query = query.eq('calendar_id', calendarId);
    }

    if (startDate) {
      query = query.gte('start_time', startDate);
    }

    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('Error fetching appointments:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch appointments',
        appointments: []
      }, { status: 500 });
    }

    // Get opportunity data for customer names
    const opportunityIds = [...new Set(appointments?.map(a => a.opportunity_id).filter(Boolean) || [])];
    
    let opportunityMap = new Map();
    if (opportunityIds.length > 0) {
      const { data: opportunities } = await supabase
        .from('opportunity_cache')
        .select('opportunity_id, title, contact_name, contact_email, contact_phone, stage')
        .eq('organization_id', organization.organizationId)
        .in('opportunity_id', opportunityIds);

      opportunityMap = new Map(
        opportunities?.map(opp => [opp.opportunity_id, opp]) || []
      );
    }

    // Format appointments with opportunity data
    const formattedAppointments = appointments?.map(apt => ({
      ...apt,
      opportunity: apt.opportunity_id ? opportunityMap.get(apt.opportunity_id) : null
    })) || [];

    return NextResponse.json({ 
      appointments: formattedAppointments,
      total: formattedAppointments.length
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch appointments',
        appointments: []
      },
      { status: 500 }
    );
  }
}