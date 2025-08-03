import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testCalendarEvents() {
  console.log('🔍 Testing GoHighLevel Calendar Events API...\n');
  
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
    
    const locationId = integration.config.locationId;
    console.log('Location ID:', locationId);
    
    // Decrypt tokens
    const { decrypt } = await import('../lib/utils/encryption');
    const decryptedTokens = decrypt(integration.config.encryptedTokens);
    const tokens = JSON.parse(decryptedTokens);
    
    console.log('Token info:');
    console.log('- Has access token:', !!tokens.accessToken);
    console.log('- Token prefix:', tokens.accessToken?.substring(0, 20) + '...');
    
    // Test various calendar-related endpoints
    const endpoints = [
      { path: `/calendars/events?locationId=${locationId}`, desc: 'Calendar Events' },
      { path: `/calendars/events/appointments?locationId=${locationId}`, desc: 'Calendar Appointments' },
      { path: `/appointments?locationId=${locationId}`, desc: 'Appointments (v1 style)' },
      { path: `/calendars?locationId=${locationId}`, desc: 'Calendars list' },
      { path: `/calendar/groups?locationId=${locationId}`, desc: 'Calendar Groups' },
      { path: `/locations/${locationId}/calendars`, desc: 'Location-based calendars' }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTesting: ${endpoint.desc}`);
      console.log(`Path: ${endpoint.path}`);
      
      try {
        const response = await fetch(`https://services.leadconnectorhq.com${endpoint.path}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Version': '2021-07-28',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ SUCCESS! Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
        } else {
          const errorText = await response.text();
          console.log('❌ Error:', errorText || response.statusText);
        }
      } catch (error: any) {
        console.log('❌ Request failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testCalendarEvents().catch(console.error);