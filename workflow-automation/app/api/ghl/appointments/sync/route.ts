import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function POST(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const supabase = getServiceSupabase();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const body = await request.json();
    const { calendarId } = body;

    if (!calendarId) {
      return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
    }

    // Get organization's GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    if (integrationError || !integration) {
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found',
        success: false 
      }, { status: 404 });
    }

    // Check if we have encrypted tokens
    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ 
        error: 'GoHighLevel tokens not found',
        success: false 
      }, { status: 400 });
    }

    // Create GHL client
    const client = await createGHLClient(integration.config.encryptedTokens);
    const locationId = integration.config.locationId || client.getLocationId();

    // Fetch appointments from GoHighLevel
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Get appointments from last month
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2); // Get appointments up to 2 months ahead

    const appointments = await client.getAppointments({
      calendarId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    if (!appointments || !Array.isArray(appointments.appointments)) {
      return NextResponse.json({ 
        success: true,
        synced: 0,
        message: 'No appointments found'
      });
    }

    // Get team members to match assigned users
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, external_id, full_name, email')
      .eq('organization_id', organization.organizationId)
      .not('external_id', 'is', null);

    const teamMemberMap = new Map(
      teamMembers?.map(tm => [tm.external_id, tm]) || []
    );

    // Get opportunity cache to link appointments
    const { data: opportunities } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, title, contact_name, contact_id')
      .eq('organization_id', organization.organizationId);

    const opportunityMap = new Map(
      opportunities?.map(opp => [opp.opportunity_id, opp]) || []
    );

    // Process and store appointments
    let syncedCount = 0;
    const appointmentBatch = [];

    for (const apt of appointments.appointments) {
      const appointmentId = apt.id || apt._id;
      if (!appointmentId) continue;

      // Find team member if assigned
      const teamMember = apt.assignedUserId ? teamMemberMap.get(apt.assignedUserId) : null;
      
      // Find opportunity if linked
      const opportunity = apt.opportunityId ? opportunityMap.get(apt.opportunityId) : null;

      const appointmentData = {
        organization_id: organization.organizationId,
        integration_id: integration.id,
        calendar_id: calendarId,
        appointment_id: appointmentId,
        opportunity_id: apt.opportunityId || null,
        contact_id: apt.contactId || opportunity?.contact_id || null,
        assigned_to: apt.assignedUserId || null,
        team_member_id: teamMember?.id || null,
        title: apt.title || apt.appointmentTitle || 'Appointment',
        start_time: apt.startTime || apt.selectedTimezone,
        end_time: apt.endTime || new Date(new Date(apt.startTime).getTime() + (apt.duration || 60) * 60000).toISOString(),
        status: apt.appointmentStatus || apt.status || 'scheduled',
        appointment_type: apt.appointmentType || apt.calendarType || null,
        description: apt.notes || apt.description || null,
        internal_notes: apt.internalNotes || null,
        ghl_data: {
          selectedSlot: apt.selectedSlot,
          selectedTimezone: apt.selectedTimezone,
          calendarNotes: apt.calendarNotes,
          address: apt.address
        },
        last_synced_at: new Date().toISOString()
      };

      appointmentBatch.push(appointmentData);
    }

    // Batch upsert appointments
    if (appointmentBatch.length > 0) {
      const { error: upsertError } = await supabase
        .from('ghl_appointments')
        .upsert(appointmentBatch, {
          onConflict: 'organization_id,appointment_id'
        });

      if (upsertError) {
        console.error('Error upserting appointments:', upsertError);
        return NextResponse.json({ 
          error: 'Failed to sync appointments',
          details: upsertError.message,
          success: false
        }, { status: 500 });
      }

      syncedCount = appointmentBatch.length;
    }

    // Clean up old appointments that no longer exist in GHL
    const currentAppointmentIds = appointmentBatch.map(a => a.appointment_id);
    
    const { error: deleteError } = await supabase
      .from('ghl_appointments')
      .update({ status: 'cancelled' })
      .eq('organization_id', organization.organizationId)
      .eq('calendar_id', calendarId)
      .not('appointment_id', 'in', `(${currentAppointmentIds.join(',')})`)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (deleteError) {
      console.error('Error marking cancelled appointments:', deleteError);
    }

    return NextResponse.json({ 
      success: true,
      synced: syncedCount,
      message: `Successfully synced ${syncedCount} appointments`
    });

  } catch (error) {
    console.error('Error syncing appointments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync appointments',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}

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

    // Build query
    let query = supabase
      .from('ghl_appointments')
      .select(`
        *,
        team_member:team_members(id, full_name, email, external_id)
      `)
      .eq('organization_id', organization.organizationId)
      .order('start_time', { ascending: true });

    if (calendarId) {
      query = query.eq('calendar_id', calendarId);
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
        .select('opportunity_id, title, contact_name, contact_email, contact_phone')
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