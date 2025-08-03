import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testCalendarEndpointVersions() {
  console.log('🔍 Testing different GHL Calendar endpoint versions...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get a user and their integration
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .limit(1);
      
    if (!users || users.length === 0) {
      console.error('No users found');
      return;
    }
    
    const userId = users[0].id;
    
    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
      
    if (!orgMember) {
      console.error('User not part of any organization');
      return;
    }
    
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', orgMember.organization_id)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (!integration?.config?.encryptedTokens) {
      console.error('No GHL integration found');
      return;
    }
    
    // Create GHL client
    const client = await createGHLClient(integration.config.encryptedTokens);
    const locationId = integration.config.locationId || client.getLocationId();
    
    console.log('Using location ID:', locationId);
    console.log('\nTesting various endpoint patterns:\n');
    
    // Test different endpoint variations
    const endpoints = [
      // V2 patterns
      { path: `/v2/calendars?locationId=${locationId}`, desc: 'V2 prefix without trailing slash' },
      { path: `/v2/calendars/?locationId=${locationId}`, desc: 'V2 prefix with trailing slash' },
      { path: `/calendars/v2?locationId=${locationId}`, desc: 'V2 suffix' },
      
      // Calendar groups endpoints
      { path: `/calendars/groups?locationId=${locationId}`, desc: 'Calendar groups (v1)' },
      { path: `/v2/calendars/groups?locationId=${locationId}`, desc: 'Calendar groups (v2)' },
      
      // Calendar services endpoints  
      { path: `/calendars/services?locationId=${locationId}`, desc: 'Calendar services' },
      
      // Working endpoints from other parts of the app
      { path: `/locations/${locationId}/calendars`, desc: 'Location-based calendars' },
      { path: `/locations/${locationId}`, desc: 'Location details (control test)' }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`Testing: ${endpoint.desc}`);
      console.log(`   Path: ${endpoint.path}`);
      
      try {
        const response = await client.makeRequest(endpoint.path, {
          method: 'GET',
          headers: {
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        });
        
        console.log(`   ✅ SUCCESS!`);
        console.log(`   Response:`, JSON.stringify(response, null, 2).substring(0, 200) + '...\n');
        
        // If it's a calendar endpoint and successful, show calendar count
        if (endpoint.path.includes('calendar') && response) {
          const calendarCount = response.calendars?.length || 
                               response.data?.length || 
                               (Array.isArray(response) ? response.length : 0);
          console.log(`   📅 Found ${calendarCount} calendars\n`);
        }
        
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (error.message.includes('404')) {
          console.log(`   (Endpoint not found)\n`);
        } else if (error.message.includes('401')) {
          console.log(`   (Unauthorized - token issue)\n`);
        } else {
          console.log(`   (${error.status || 'Unknown error'})\n`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the test
testCalendarEndpointVersions().catch(console.error);