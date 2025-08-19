#!/usr/bin/env tsx

/**
 * Test Signup Flow Script
 * 
 * This script tests the signup process to see where it's failing
 * and why users aren't being created in the public.users table.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseAnonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseServiceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSignupFlow() {
  console.log('🧪 Testing signup flow...\n');

  try {
    // Test data
    const testEmail = `testuser${Date.now()}@gmail.com`;
    const testPassword = 'testpassword123';
    const testFullName = 'Test User';
    const testOrgName = 'Test Organization';

    // Step 1: Sign up the user using our custom API route
    console.log('1. Testing user signup via custom API route...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Name: ${testFullName}`);
    console.log(`   Organization: ${testOrgName}\n`);

    const signupResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')}/api/auth/signup-production`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: testFullName,
        organizationName: testOrgName,
      }),
    });

    if (!signupResponse.ok) {
      const errorData = await signupResponse.json();
      console.error('❌ Signup API call failed:', errorData);
      return;
    }

    const signupResult = await signupResponse.json();
    console.log('✅ Signup API call successful:', signupResult);

    // Now check if the user was created in auth.users
    const { data: authUsers, error: authUsersError } = await supabaseServiceClient.auth.admin.listUsers();
    if (authUsersError) {
      console.error('❌ Error listing auth users:', authUsersError);
      return;
    }

    const createdUser = authUsers.users.find(u => u.email === testEmail);
    if (!createdUser) {
      console.error('❌ User not found in auth.users after signup');
      return;
    }

    console.log('✅ Auth user created successfully');
    console.log(`   User ID: ${createdUser.id}`);
    console.log(`   Email: ${createdUser.email}\n`);

    // Step 2: Check if user exists in auth.users
    console.log('2. Checking auth.users table...');
    const { data: authUser, error: authUserError } = await supabaseServiceClient.auth.admin.getUserById(createdUser.id);
    
    if (authUserError) {
      console.error('❌ Error fetching auth user:', authUserError);
    } else {
      console.log('✅ User found in auth.users table');
      console.log(`   Raw user meta:`, authUser.user?.user_metadata);
    }

    // Step 3: Check if user exists in public.users
    console.log('\n3. Checking public.users table...');
    const { data: publicUser, error: publicUserError } = await supabaseServiceClient
      .from('users')
      .select('*')
      .eq('id', createdUser.id)
      .single();

    if (publicUserError) {
      console.error('❌ User NOT found in public.users table:', publicUserError.message);
    } else {
      console.log('✅ User found in public.users table');
      console.log(`   User data:`, publicUser);
    }

    // Step 4: Check if organization exists
    console.log('\n4. Checking organizations table...');
    const { data: orgs, error: orgsError } = await supabaseServiceClient
      .from('organizations')
      .select('*')
      .eq('created_by', createdUser.id);

    if (orgsError) {
      console.error('❌ Error checking organizations:', orgsError);
    } else if (!orgs || orgs.length === 0) {
      console.log('❌ No organization found for user');
    } else {
      console.log('✅ Organization found');
      console.log(`   Organization:`, orgs[0]);
    }

    // Step 5: Check if organization membership exists
    console.log('\n5. Checking organization_members table...');
    const { data: members, error: membersError } = await supabaseServiceClient
      .from('organization_members')
      .select('*')
      .eq('user_id', createdUser.id);

    if (membersError) {
      console.error('❌ Error checking organization members:', membersError);
    } else if (!members || members.length === 0) {
      console.log('❌ No organization membership found for user');
    } else {
      console.log('✅ Organization membership found');
      console.log(`   Membership:`, members[0]);
    }

    // Step 6: Clean up - delete the test user
    console.log('\n6. Cleaning up test user...');
    try {
      await supabaseServiceClient.auth.admin.deleteUser(createdUser.id);
      console.log('✅ Test user cleaned up');
    } catch (cleanupError) {
      console.error('❌ Error cleaning up test user:', cleanupError);
    }

    console.log('\n📊 Summary:');
    if (publicUser) {
      console.log('✅ User profile created successfully');
    } else {
      console.log('❌ User profile creation FAILED');
    }

    if (orgs && orgs.length > 0) {
      console.log('✅ Organization created successfully');
    } else {
      console.log('❌ Organization creation FAILED');
    }

    if (members && members.length > 0) {
      console.log('✅ Organization membership created successfully');
    } else {
      console.log('❌ Organization membership creation FAILED');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testSignupFlow()
    .then(() => {
      console.log('\n🎉 Test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testSignupFlow };
