import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGHLUsersLookup() {
  try {
    console.log('Testing GHL Users Lookup...\n');

    // Get the first organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .limit(1)
      .single();

    if (error || !integration) {
      console.error('No GHL integration found:', error);
      return;
    }

    console.log('Found integration for organization:', integration.organization_id);
    console.log('Location ID:', integration.config.locationId);

    // Create GHL client
    const ghlClient = await createGHLClient(
      integration.config.encryptedTokens,
      async (newTokens) => {
        console.log('Token refresh callback triggered');
      }
    );

    // Test different endpoints to find user data
    console.log('\n1. Testing /users endpoint...');
    
    try {
      const usersResponse = await ghlClient.makeRequest(
        `/users?locationId=${integration.config.locationId}`
      );
      console.log('Users endpoint response:', JSON.stringify(usersResponse, null, 2));
    } catch (error) {
      console.log('Users endpoint error:', error.message);
    }

    // Test location users endpoint
    console.log('\n2. Testing /locations/{locationId}/users endpoint...');
    
    try {
      const locationUsersResponse = await ghlClient.makeRequest(
        `/locations/${integration.config.locationId}/users`
      );
      console.log('Location users response:', JSON.stringify(locationUsersResponse, null, 2));
    } catch (error) {
      console.log('Location users endpoint error:', error.message);
    }

    // Test the automake users endpoint
    console.log('\n3. Testing our /api/integrations/automake/users endpoint...');
    
    const { data: ourUsers, error: ourError } = await supabase
      .from('team_members')
      .select('*')
      .eq('organization_id', integration.organization_id);

    if (ourUsers && ourUsers.length > 0) {
      console.log('\nTeam members in our database:');
      ourUsers.forEach(user => {
        console.log(`- ID: ${user.ghl_user_id}, Name: ${user.name}, Email: ${user.email}`);
      });
    }

    // Look for specific user ID from the opportunities
    const testUserId = 'RhzIDf63vqKJ9tDk2MQU'; // From MAREENA FINKE opportunity
    
    console.log(`\n4. Looking up specific user: ${testUserId}`);
    
    try {
      const userResponse = await ghlClient.makeRequest(
        `/users/${testUserId}`
      );
      console.log('Specific user response:', JSON.stringify(userResponse, null, 2));
    } catch (error) {
      console.log('Specific user lookup error:', error.message);
    }

    // Try team endpoint
    console.log('\n5. Testing /locations/{locationId}/team endpoint...');
    
    try {
      const teamResponse = await ghlClient.makeRequest(
        `/locations/${integration.config.locationId}/team`
      );
      console.log('Team endpoint response:', JSON.stringify(teamResponse, null, 2));
    } catch (error) {
      console.log('Team endpoint error:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testGHLUsersLookup();