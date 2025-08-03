import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testGHLCalendarV2() {
  console.log('🔍 Testing GHL Calendar v2 API...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get the first user to test with
    console.log('1. Finding a test user...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
      
    if (userError || !users || users.length === 0) {
      console.error('No users found:', userError);
      return;
    }
    
    const userId = users[0].id;
    console.log('✅ Found user:', users[0].email);
    
    // Get user's organization
    console.log('\n2. Getting user organization...');
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, organizations!inner(name)')
      .eq('user_id', userId)
      .single();
      
    if (orgError || !orgMember) {
      console.error('User not part of any organization:', orgError);
      return;
    }
    
    console.log('✅ Found organization:', (orgMember as any).organizations.name);
    
    // Get organization's GHL integration
    console.log('\n3. Fetching GHL integration...');
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', orgMember.organization_id)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (intError || !integration) {
      console.error('No GHL integration found:', intError);
      return;
    }
    
    console.log('✅ Found integration');
    console.log('   Location ID:', integration.config?.locationId || 'NOT SET');
    console.log('   Company ID:', integration.config?.companyId || 'NOT SET');
    
    if (!integration.config?.encryptedTokens) {
      console.error('❌ No encrypted tokens found');
      return;
    }
    
    // Get MCP token if available
    console.log('\n4. Checking for MCP integration...');
    const { data: mcpIntegration } = await supabase
      .from('mcp_integrations')
      .select('private_integration_token')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();
      
    if (mcpIntegration?.private_integration_token) {
      console.log('✅ Found MCP token');
    } else {
      console.log('⚠️  No MCP token found (optional)');
    }
    
    // Create GHL client
    console.log('\n5. Creating GHL client...');
    const client = await createGHLClient(
      integration.config.encryptedTokens,
      undefined,
      mcpIntegration?.private_integration_token
    );
    console.log('✅ Client created');
    
    // Get location ID
    const locationId = integration.config.locationId || client.getLocationId();
    console.log('\n6. Using location ID:', locationId);
    
    if (!locationId) {
      console.error('❌ No location ID available!');
      return;
    }
    
    // Test different endpoint formats
    console.log('\n7. Testing calendar endpoints...');
    
    // Test 1: With trailing slash (as per API docs)
    console.log('\n   a) Testing /calendars/ with trailing slash...');
    try {
      const response1 = await client.makeRequest(`/calendars/?locationId=${locationId}`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      console.log('   ✅ Success with trailing slash!');
      console.log('   Response:', JSON.stringify(response1, null, 2));
      
      if (response1?.calendars && Array.isArray(response1.calendars)) {
        console.log(`\n   Found ${response1.calendars.length} calendars:`);
        response1.calendars.forEach((cal: any, index: number) => {
          console.log(`   ${index + 1}. ${cal.name} (${cal.id})`);
        });
      }
    } catch (error: any) {
      console.log('   ❌ Failed with trailing slash:', error.message);
    }
    
    // Test 2: Without trailing slash
    console.log('\n   b) Testing /calendars without trailing slash...');
    try {
      const response2 = await client.makeRequest(`/calendars?locationId=${locationId}`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      console.log('   ✅ Success without trailing slash!');
      console.log('   Response:', JSON.stringify(response2, null, 2));
    } catch (error: any) {
      console.log('   ❌ Failed without trailing slash:', error.message);
    }
    
    // Test 3: Try v1 endpoint format
    console.log('\n   c) Testing v1 endpoint format /calendars/groups...');
    try {
      const response3 = await client.makeRequest(`/calendars/groups?locationId=${locationId}`, {
        method: 'GET'
      });
      console.log('   ✅ Success with groups endpoint!');
      console.log('   Response:', JSON.stringify(response3, null, 2));
    } catch (error: any) {
      console.log('   ❌ Failed with groups endpoint:', error.message);
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the test
testGHLCalendarV2().catch(console.error);