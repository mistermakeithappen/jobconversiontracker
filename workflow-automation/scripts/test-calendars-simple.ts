import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testCalendarsSimple() {
  console.log('🔍 Testing GoHighLevel Calendars API...\n');
  
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
    console.log('- Expires at:', new Date(tokens.expiresAt || integration.expires_at).toISOString());
    console.log('- Current time:', new Date().toISOString());
    
    // Make direct API call to calendars endpoint
    console.log('\nTesting direct API call to /calendars...');
    
    const response = await fetch(`https://services.leadconnectorhq.com/calendars?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Version': '2021-07-28',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      
      // Try with trailing slash
      console.log('\nTrying with trailing slash...');
      const response2 = await fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${locationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Version': '2021-07-28',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response2 status:', response2.status);
      
      if (response2.ok) {
        const data = await response2.json();
        console.log('Success! Calendars:', JSON.stringify(data, null, 2));
      } else {
        const error2 = await response2.text();
        console.log('Error2:', error2);
      }
    } else {
      const data = await response.json();
      console.log('Success! Calendars:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testCalendarsSimple().catch(console.error);