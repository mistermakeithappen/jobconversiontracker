import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    
    // Get user's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // Create GHL client without locationId first
    const ghlClient = await createGHLClient(
      integration.config?.encryptedTokens || '',
      async (newTokens) => {
        const encryptedTokens = encrypt(JSON.stringify(newTokens));
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              encryptedTokens,
              lastTokenRefresh: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
      }
    );
    
    // Make requests to get user's accessible locations
    try {
      // Try multiple approaches to get location data
      let locations = [];
      let currentUser = null;
      
      // First, try to get current user info
      try {
        currentUser = await ghlClient.getCurrentUser();
        console.log('Current user:', currentUser);
      } catch (error) {
        console.log('Could not fetch current user:', error);
      }
      
      // Try to get accessible locations
      try {
        const locationsResponse = await ghlClient.getAccessibleLocations();
        console.log('Locations response:', locationsResponse);
        locations = locationsResponse.locations || locationsResponse || [];
      } catch (error) {
        console.log('Could not fetch locations list:', error);
      }
      
      // If we have a user with locations, use those
      if (currentUser?.locations) {
        locations = currentUser.locations;
      }
      
      // If still no locations but we have a company ID, try company locations
      if (locations.length === 0 && integration.config?.companyId) {
        try {
          const companyResponse = await fetch(`https://services.leadconnectorhq.com/companies/${integration.config?.companyId}/locations`, {
            headers: {
              'Authorization': `Bearer ${(ghlClient as any).accessToken}`,
              'Version': '2021-07-28',
              'Accept': 'application/json'
            }
          });
          
          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            locations = companyData.locations || [];
          }
        } catch (error) {
          console.log('Could not fetch company locations:', error);
        }
      }
      
      // If we got locations, update the integration with the first location ID
      if (locations.length > 0 && !integration.config?.locationId) {
        const firstLocation = locations[0];
        const firstLocationId = firstLocation.id || firstLocation._id || firstLocation.locationId;
        
        console.log('Setting location ID to:', firstLocationId);
        
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              locationId: firstLocationId,
              locations: locations
            }
          })
          .eq('id', integration.id);
      }
      
      return NextResponse.json({ 
        locations,
        currentUser,
        currentLocationId: integration.config.locationId || (locations[0]?.id || locations[0]?._id || locations[0]?.locationId)
      });
      
    } catch (apiError: any) {
      console.error('Error fetching locations:', apiError);
      return NextResponse.json({ 
        error: 'Failed to fetch locations',
        details: apiError.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in locations endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}