import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { requireSubscription } from '@/lib/utils/subscription-utils';
import { format, parse } from 'date-fns';

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
    const {
      calendarId,
      opportunityId,
      teamMemberId,
      dateStart,
      dateEnd,
      timeStart,
      timeEnd,
      includeWeekends,
      instructions,
      internalNotes,
      appointmentDates
    } = body;

    // Validate required fields
    if (!calendarId || !opportunityId || !teamMemberId || !appointmentDates || appointmentDates.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        success: false 
      }, { status: 400 });
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

    // Get team member details
    const { data: teamMember, error: teamMemberError } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', teamMemberId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (teamMemberError || !teamMember) {
      return NextResponse.json({ 
        error: 'Team member not found',
        success: false 
      }, { status: 404 });
    }

    if (!teamMember.external_id) {
      return NextResponse.json({ 
        error: 'Team member is not linked to a GoHighLevel user',
        success: false 
      }, { status: 400 });
    }

    // Get opportunity details for customer name
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (oppError || !opportunity) {
      return NextResponse.json({ 
        error: 'Opportunity not found',
        success: false 
      }, { status: 404 });
    }

    // Create appointment schedule record
    const { data: schedule, error: scheduleError } = await supabase
      .from('appointment_schedules')
      .insert({
        organization_id: organization.organizationId,
        calendar_id: calendarId,
        opportunity_id: opportunityId,
        team_member_id: teamMemberId,
        date_start: dateStart,
        date_end: dateEnd,
        time_start: timeStart,
        time_end: timeEnd,
        include_weekends: includeWeekends,
        appointment_title_template: `${opportunity.contact_name} - Site Visit`,
        instructions,
        internal_notes: internalNotes,
        status: 'creating',
        created_by: userId
      })
      .select()
      .single();

    if (scheduleError || !schedule) {
      console.error('Error creating schedule:', scheduleError);
      return NextResponse.json({ 
        error: 'Failed to create schedule',
        success: false 
      }, { status: 500 });
    }

    // Create GHL client
    const client = await createGHLClient(integration.config.encryptedTokens);
    const locationId = integration.config.locationId || client.getLocationId();

    // Create appointments in GHL
    const createdAppointments = [];
    const failedAppointments = [];

    for (const dateStr of appointmentDates) {
      try {
        // Parse date and combine with times
        const appointmentDate = new Date(dateStr);
        const [startHour, startMinute] = timeStart.split(':').map(Number);
        const [endHour, endMinute] = timeEnd.split(':').map(Number);
        
        const startDateTime = new Date(appointmentDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);
        
        const endDateTime = new Date(appointmentDate);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Create appointment via GHL API
        const appointmentData = {
          calendarId,
          locationId,
          contactId: opportunity.contact_id,
          opportunityId,
          title: `${opportunity.contact_name} - ${opportunity.title}`,
          appointmentStatus: 'confirmed',
          assignedUserId: teamMember.external_id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          notes: instructions || '',
          address: opportunity.contact_address || ''
        };

        // Make the API call to create appointment
        const response = await client.makeRequest('/appointments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          body: JSON.stringify(appointmentData)
        });

        if (response && response.id) {
          // Store appointment in our database
          const { error: appointmentError } = await supabase
            .from('ghl_appointments')
            .insert({
              organization_id: organization.organizationId,
              integration_id: integration.id,
              calendar_id: calendarId,
              appointment_id: response.id,
              opportunity_id: opportunityId,
              contact_id: opportunity.contact_id,
              assigned_to: teamMember.external_id,
              team_member_id: teamMemberId,
              title: appointmentData.title,
              start_time: startDateTime.toISOString(),
              end_time: endDateTime.toISOString(),
              status: 'confirmed',
              description: instructions,
              internal_notes: internalNotes,
              ghl_data: response
            });

          if (!appointmentError) {
            // Track in junction table
            await supabase
              .from('schedule_appointments')
              .insert({
                schedule_id: schedule.id,
                appointment_id: response.id
              });

            createdAppointments.push(response.id);
          }
        }
      } catch (error) {
        console.error(`Error creating appointment for ${dateStr}:`, error);
        failedAppointments.push(dateStr);
      }
    }

    // Update schedule status
    const finalStatus = failedAppointments.length === 0 ? 'completed' : 
                       createdAppointments.length === 0 ? 'failed' : 'partial';
    
    await supabase
      .from('appointment_schedules')
      .update({
        status: finalStatus,
        appointments_created: createdAppointments.length,
        error_message: failedAppointments.length > 0 ? 
          `Failed to create appointments for: ${failedAppointments.join(', ')}` : null
      })
      .eq('id', schedule.id);

    return NextResponse.json({ 
      success: true,
      created: createdAppointments.length,
      failed: failedAppointments.length,
      scheduleId: schedule.id,
      message: `Created ${createdAppointments.length} appointments${
        failedAppointments.length > 0 ? `, ${failedAppointments.length} failed` : ''
      }`
    });

  } catch (error) {
    console.error('Error creating bulk appointments:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create appointments',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}