import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  console.log('GHL Calendars API route called');
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const supabase = getServiceSupabase();
    console.log('Auth successful, userId:', userId);
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Get organization's GHL integration
    console.log('Looking for GHL integration for org:', organization.organizationId);
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    if (error || !integration) {
      console.log('Integration lookup error:', error);
      console.log('Integration data:', {
      hasConfig: !!integration?.config,
      hasEncryptedTokens: !!integration?.config?.encryptedTokens,
      locationId: integration?.config?.locationId
    });
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found', 
        details: 'Please connect your GoHighLevel account in settings',
        calendars: [] 
      }, { status: 200 });
    }
    
    // Check if we have encrypted tokens
    if (!integration.config?.encryptedTokens) {
      console.log('No encrypted tokens found in config');
      return NextResponse.json({ 
        error: 'GoHighLevel tokens not found', 
        details: 'Please reconnect your GoHighLevel account',
        calendars: [] 
      }, { status: 200 });
    }
    
    // Get MCP integration if available
    let mcpApiKey: string | undefined;
    const { data: mcpIntegration } = await supabase
      .from('mcp_integrations')
      .select('private_integration_token')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();
    
    if (mcpIntegration?.private_integration_token) {
      mcpApiKey = mcpIntegration.private_integration_token;
    }
    
    // Create GHL client
    const client = await createGHLClient(
      integration.config.encryptedTokens,
      undefined,
      mcpApiKey
    );
    
    // Get location ID from config
    const locationId = integration.config.locationId || client.getLocationId();
    
    if (!locationId) {
      return NextResponse.json({ calendars: [] });
    }
    
    // Fetch calendars from GoHighLevel
    try {
      console.log('Fetching calendars for location:', locationId);
      
      // Make direct request to the calendars endpoint
      const response = await client.makeRequest(`/calendars/?locationId=${locationId}`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      
      console.log('Calendars API response:', response);
      
      let calendars: any[] = [];
      
      // Handle different response formats
      if (response?.calendars && Array.isArray(response.calendars)) {
        calendars = response.calendars;
      } else if (Array.isArray(response)) {
        calendars = response;
      } else if (response?.data && Array.isArray(response.data)) {
        calendars = response.data;
      }
      
      // Get existing calendars from database for cleanup
      const { data: existingCalendars } = await supabase
        .from('ghl_calendars')
        .select('calendar_id')
        .eq('organization_id', organization.organizationId)
        .eq('integration_id', integration.id);
      
      const existingCalendarIds = new Set(existingCalendars?.map(c => c.calendar_id) || []);
      const currentCalendarIds = new Set<string>();
      
      // Process and store calendars
      const processedCalendars = [];
      
      for (const cal of calendars) {
        const calendarId = cal.id || cal._id;
        if (!calendarId) continue;
        
        currentCalendarIds.add(calendarId);
        
        const calendarData = {
          organization_id: organization.organizationId,
          integration_id: integration.id,
          calendar_id: calendarId,
          location_id: cal.locationId || locationId,
          name: cal.name || 'Unnamed Calendar',
          description: cal.description || '',
          calendar_type: cal.calendarType || cal.type || 'appointment',
          is_active: cal.isActive !== false,
          metadata: {
            slug: cal.slug,
            widgetType: cal.widgetType,
            groupId: cal.groupId,
            groupName: cal.groupName,
            teamMembers: cal.teamMembers || [],
            settings: cal.settings || {}
          },
          last_synced_at: new Date().toISOString()
        };
        
        // Upsert calendar to database
        const { error: upsertError } = await supabase
          .from('ghl_calendars')
          .upsert(calendarData, {
            onConflict: 'organization_id,calendar_id'
          });
        
        if (upsertError) {
          console.error('Error upserting calendar:', upsertError);
        }
        
        processedCalendars.push({
          id: calendarId,
          name: calendarData.name,
          description: calendarData.description,
          type: calendarData.calendar_type,
          isActive: calendarData.is_active,
          locationId: calendarData.location_id,
          ...calendarData.metadata
        });
      }
      
      // Clean up calendars that no longer exist
      const calendarsToDelete = Array.from(existingCalendarIds).filter(
        id => !currentCalendarIds.has(id)
      );
      
      if (calendarsToDelete.length > 0) {
        console.log('Deleting removed calendars:', calendarsToDelete);
        const { error: deleteError } = await supabase
          .from('ghl_calendars')
          .delete()
          .eq('organization_id', organization.organizationId)
          .in('calendar_id', calendarsToDelete);
        
        if (deleteError) {
          console.error('Error deleting old calendars:', deleteError);
        }
      }
      
      console.log(`Synced ${processedCalendars.length} calendars for location ${locationId}`);
      
      return NextResponse.json({ 
        calendars: processedCalendars,
        locationId,
        success: true,
        synced: processedCalendars.length,
        deleted: calendarsToDelete.length
      });
      
    } catch (error: any) {
      console.error('Error fetching calendars:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        response: error.response
      });
      
      // Return cached calendars from database if API fails
      const { data: cachedCalendars } = await supabase
        .from('ghl_calendars')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .eq('is_active', true);
      
      const calendars = cachedCalendars?.map(cal => ({
        id: cal.calendar_id,
        name: cal.name,
        description: cal.description,
        type: cal.calendar_type,
        isActive: cal.is_active,
        locationId: cal.location_id,
        ...(cal.metadata || {})
      })) || [];
      
      return NextResponse.json({ 
        calendars,
        locationId,
        success: false,
        cached: true,
        error: error.message || 'Failed to fetch calendars from API',
        details: 'Returning cached calendars from database'
      });
    }
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendars',
        details: error instanceof Error ? error.message : 'Unknown error',
        calendars: []
      },
      { status: 200 }
    );
  }
}