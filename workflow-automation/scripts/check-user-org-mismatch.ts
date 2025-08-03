import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUserOrgMismatch() {
  try {
    console.log('Checking User/Organization Mismatch...\n');

    const userEmail = 'infoburganhomeservices@gmail.com';
    const userId = '2c760c74-f4ba-482c-a942-2198166b98e8';

    // 1. Check organizations
    console.log('1. All organizations:');
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    orgs?.forEach(org => {
      console.log(`\n- ${org.name}`);
      console.log(`  ID: ${org.id}`);
      console.log(`  Created: ${new Date(org.created_at).toLocaleString()}`);
    });

    // 2. Check organization members
    console.log('\n\n2. Organization members:');
    const { data: members } = await supabase
      .from('organization_members')
      .select('*');

    members?.forEach(member => {
      console.log(`\n- User ID: ${member.user_id}`);
      console.log(`  Org ID: ${member.organization_id}`);
      console.log(`  Role: ${member.role}`);
      console.log(`  Status: ${member.status}`);
    });

    // 3. Check which organization the user thinks they're in
    console.log(`\n\n3. Checking auth for user ${userId}...`);
    
    // Check if user exists in auth
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    
    if (authData?.user) {
      console.log('\nAuth user found:');
      console.log(`- Email: ${authData.user.email}`);
      console.log(`- Created: ${new Date(authData.user.created_at).toLocaleString()}`);
      console.log(`- App metadata:`, authData.user.app_metadata);
      console.log(`- User metadata:`, authData.user.user_metadata);
    } else {
      console.log('❌ User not found in auth');
    }

    // 4. Check which organization has the GHL integration
    console.log('\n\n4. GHL Integration organization:');
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integration) {
      console.log(`\n- Organization ID: ${integration.organization_id}`);
      console.log(`- Location ID: ${integration.config?.locationId}`);
      
      // Find org name
      const org = orgs?.find(o => o.id === integration.organization_id);
      console.log(`- Organization Name: ${org?.name || 'Unknown'}`);
    }

    // 5. Check if there's a user record
    console.log('\n\n5. User records:');
    const { data: users } = await supabase
      .from('users')
      .select('*');

    if (users && users.length > 0) {
      users.forEach(user => {
        console.log(`\n- ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Org ID: ${user.organization_id}`);
      });
    } else {
      console.log('❌ No users in users table');
    }

    // 6. Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Auth User ID: ${userId}`);
    console.log(`Auth User Email: ${userEmail}`);
    console.log(`Organizations: ${orgs?.length || 0}`);
    console.log(`GHL Integration Org: ${integration?.organization_id || 'None'}`);
    console.log(`User's Organization: ???`);
    console.log('\nThe issue is likely that the logged-in user is not in the same organization as the GHL integration.');

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkUserOrgMismatch();