import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  
  try {
    // Get data from request body (sent from callback)
    const { integrationId, userId, locationId, companyId } = await request.json();
    
    if (!integrationId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Get organization for the user
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Parameters already extracted above
    
    // Get the integration using organization_id
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId)
      .single();
      
    if (integrationError || !integration) {
      console.error('Error fetching integration:', integrationError);
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }
    
    // Create GHL client
    const client = await createGHLClient(integration.config?.encryptedTokens || '');
    
    const updatedConfig = { ...integration.config };
    
    // Fetch location details if we have locationId
    if (locationId) {
      try {
        const location = await client.makeRequest(`/locations/${locationId}`, { method: 'GET' });
        
        if (location) {
          // GHL API v2 structure
          const locationData = location.location || location;
          
          // Check different possible field names
          const locationName = locationData.name || 
                             locationData.companyName || 
                             locationData.businessName || 
                             locationData.business?.name ||
                             '';
          
          updatedConfig.locationName = locationName;
          updatedConfig.locationTimezone = locationData.timezone || '';
          updatedConfig.locationAddress = {
            address: locationData.address || locationData.address1 || '',
            city: locationData.city || '',
            state: locationData.state || '',
            postalCode: locationData.postalCode || locationData.zip || '',
            country: locationData.country || 'US'
          };
          updatedConfig.locationPhone = locationData.phone || '';
          updatedConfig.locationEmail = locationData.email || '';
          updatedConfig.locationWebsite = locationData.website || '';
        }
      } catch (error) {
        console.error('Error fetching location details:', error);
        // Try alternative approach - get it from accessible locations
        try {
          const searchResponse = await client.makeRequest('/locations/search', { method: 'GET' });
          
          if (searchResponse?.locations) {
            const matchingLocation = searchResponse.locations.find((loc: any) => 
              loc.id === locationId || loc._id === locationId
            );
            
            if (matchingLocation) {
              updatedConfig.locationName = matchingLocation.name || matchingLocation.companyName || '';
            }
          }
        } catch (searchError) {
          console.error('Error searching locations:', searchError);
        }
      }
    }
    
    // Fetch user details
    try {
      const user = await client.makeRequest('/users/me', { method: 'GET' });
      
      if (user) {
        updatedConfig.userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        updatedConfig.userEmail = user.email || updatedConfig.email || '';
        updatedConfig.userRole = user.role || user.type || updatedConfig.userType || '';
        updatedConfig.userPhone = user.phone || '';
        updatedConfig.userPermissions = user.permissions || [];
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
    
    // Fetch accessible locations to get company info
    try {
      const locations = await client.makeRequest('/locations/search', { method: 'GET' });
      
      if (locations?.locations && locations.locations.length > 0) {
        // Store all accessible locations
        updatedConfig.accessibleLocations = locations.locations.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          companyId: loc.companyId
        }));
        
        // If we don't have a company name yet, try to find it
        if (companyId && !updatedConfig.companyName) {
          const companyLocation = locations.locations.find((loc: any) => loc.companyId === companyId);
          if (companyLocation?.company) {
            updatedConfig.companyName = companyLocation.company.name || '';
          }
        }
      }
    } catch (error) {
      console.error('Error fetching accessible locations:', error);
    }
    
    // Fetch pipelines for the location
    if (locationId) {
      try {
        const queryParams = new URLSearchParams({ locationId });
        const pipelines = await client.makeRequest(`/opportunities/pipelines?${queryParams}`, { method: 'GET' });
        
        if (pipelines?.pipelines) {
          updatedConfig.pipelines = pipelines.pipelines.map((pipeline: any) => ({
            id: pipeline.id,
            name: pipeline.name,
            stages: pipeline.stages?.length || 0
          }));
        }
      } catch (error) {
        console.error('Error fetching pipelines:', error);
      }
    }
    
    // Update the integration with all the fetched details
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId);
      
    if (updateError) {
      console.error('Error updating integration:', updateError);
      return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
    }
    
    // Also check if we need to update existing tables with location info
    if (locationId) {
      // Update ghl_products with location_id if not set
      await supabase
        .from('ghl_products')
        .update({ location_id: locationId })
        .eq('integration_id', integrationId)
        .is('location_id', null);
        
      // Update pipeline_stages with location_id if not set
      await supabase
        .from('pipeline_stages')
        .update({ location_id: locationId })
        .eq('integration_id', integrationId)
        .is('location_id', null);
    }
    
    return NextResponse.json({ 
      success: true,
      details: {
        locationName: updatedConfig.locationName,
        userName: updatedConfig.userName,
        companyName: updatedConfig.companyName,
        pipelines: updatedConfig.pipelines?.length || 0,
        accessibleLocations: updatedConfig.accessibleLocations?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error in fetch-details:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}