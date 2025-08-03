import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testCalendarGroups() {
  console.log('🔍 Testing calendar groups endpoint...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get user's GHL integration
    console.log('1. Fetching GHL integration for user:', mockUserId);
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('user_id', mockUserId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (error) {
      console.error('Error fetching integration:', error);
      return;
    }
    
    if (!integration?.config?.encryptedTokens) {
      console.error('No GHL integration found');
      return;
    }
    
    console.log('✅ Found integration');
    console.log('   Location ID:', integration.config.locationId || 'NOT SET');
    
    // Create GHL client
    console.log('\n2. Creating GHL client...');
    const client = await createGHLClient(integration.config.encryptedTokens);
    console.log('✅ Client created');
    
    const locationId = integration.config.locationId || client.getLocationId();
    
    // Try different calendar endpoints
    console.log('\n3. Testing different calendar endpoints...');
    
    // Try calendar groups
    console.log('\n   a) Testing /calendars/groups...');
    try {
      const queryParams = new URLSearchParams({
        locationId: locationId
      });
      
      const groupsResponse = await client.makeRequest(`/calendars/groups?${queryParams}`, {
        method: 'GET'
      });
      
      console.log('Calendar Groups Response:', JSON.stringify(groupsResponse, null, 2));
    } catch (err: any) {
      console.log('Calendar Groups Error:', err.message);
    }
    
    // Try appointments endpoint
    console.log('\n   b) Testing /appointments...');
    try {
      const queryParams = new URLSearchParams({
        locationId: locationId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      const appointmentsResponse = await client.makeRequest(`/appointments?${queryParams}`, {
        method: 'GET'
      });
      
      console.log('Appointments Response:', JSON.stringify(appointmentsResponse, null, 2));
    } catch (err: any) {
      console.log('Appointments Error:', err.message);
    }
    
    // Try calendar services (which might be the actual calendars)
    console.log('\n   c) Testing /calendars/services...');
    try {
      const queryParams = new URLSearchParams({
        locationId: locationId
      });
      
      const servicesResponse = await client.makeRequest(`/calendars/services?${queryParams}`, {
        method: 'GET'
      });
      
      console.log('Calendar Services Response:', JSON.stringify(servicesResponse, null, 2));
    } catch (err: any) {
      console.log('Calendar Services Error:', err.message);
    }
    
    // Try teams endpoint (calendar teams)
    console.log('\n   d) Testing /calendars/teams...');
    try {
      const queryParams = new URLSearchParams({
        locationId: locationId
      });
      
      const teamsResponse = await client.makeRequest(`/calendars/teams?${queryParams}`, {
        method: 'GET'
      });
      
      console.log('Calendar Teams Response:', JSON.stringify(teamsResponse, null, 2));
    } catch (err: any) {
      console.log('Calendar Teams Error:', err.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the test
testCalendarGroups().catch(console.error);