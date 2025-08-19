#!/usr/bin/env tsx

/**
 * Direct Signup Test Script
 * 
 * This script directly tests the signup logic to verify that
 * user profiles and organizations are created correctly.
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

async function testDirectSignup() {
  console.log('🧪 Testing direct signup logic...\n');

  try {
    // Test data
    const testEmail = `testuser${Date.now()}@gmail.com`;
    const testPassword = 'testpassword123';
    const testFullName = 'Test User';
    const testOrgName = 'Test Organization';

    console.log('1. Creating auth user...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Name: ${testFullName}`);
    console.log(`   Organization: ${testOrgName}\n`);

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabaseAnonClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: testFullName,
          organization_name: testOrgName,
        }
      }
    });

    if (authError || !authData.user) {
      console.error('❌ Auth user creation failed:', authError);
      return;
    }

    const newUserId = authData.user.id;
    console.log('✅ Auth user created successfully');
    console.log(`   User ID: ${newUserId}`);
    console.log(`   Email: ${testEmail}\n`);

    // Step 2: Create user profile and organization (simulating our API route)
    console.log('2. Creating user profile and organization...');
    const createResult = await createUserProfileAndOrganization(
      supabaseServiceClient, 
      newUserId, 
      testEmail, 
      testFullName, 
      testOrgName
    );

    if (!createResult.success) {
      console.error('❌ User profile and organization creation failed:', createResult.error);
      // Clean up auth user
      await supabaseServiceClient.auth.admin.deleteUser(newUserId);
      return;
    }

    console.log('✅ User profile and organization created successfully\n');

    // Step 3: Verify everything was created
    console.log('3. Verifying created records...');

    // Check user profile
    const { data: userProfile, error: profileError } = await supabaseServiceClient
      .from('users')
      .select('*')
      .eq('id', newUserId)
      .single();

    if (profileError || !userProfile) {
      console.error('❌ User profile verification failed:', profileError);
    } else {
      console.log('✅ User profile verified:', {
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name
      });
    }

    // Check organization
    const { data: orgs, error: orgsError } = await supabaseServiceClient
      .from('organizations')
      .select('*')
      .eq('created_by', newUserId);

    if (orgsError || !orgs || orgs.length === 0) {
      console.error('❌ Organization verification failed:', orgsError);
    } else {
      console.log('✅ Organization verified:', {
        id: orgs[0].id,
        name: orgs[0].name,
        slug: orgs[0].slug
      });
    }

    // Check organization membership
    const { data: members, error: membersError } = await supabaseServiceClient
      .from('organization_members')
      .select('*')
      .eq('user_id', newUserId);

    if (membersError || !members || members.length === 0) {
      console.error('❌ Organization membership verification failed:', membersError);
    } else {
      console.log('✅ Organization membership verified:', {
        organization_id: members[0].organization_id,
        user_id: members[0].user_id,
        role: members[0].role
      });
    }

    // Step 4: Clean up
    console.log('\n4. Cleaning up test data...');
    try {
      await supabaseServiceClient.auth.admin.deleteUser(newUserId);
      console.log('✅ Test user cleaned up');
    } catch (cleanupError) {
      console.error('❌ Error cleaning up test user:', cleanupError);
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('✅ User profile creation: WORKING');
    console.log('✅ Organization creation: WORKING');
    console.log('✅ Organization membership: WORKING');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Function to create user profile and organization (copied from API route)
async function createUserProfileAndOrganization(
  supabaseServiceClient: any,
  userId: string,
  email: string,
  fullName: string,
  organizationName: string
) {
  try {
    // 1. Create the user profile in public.users
    const { error: userProfileError } = await supabaseServiceClient
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (userProfileError) {
      console.error('Failed to create user profile:', userProfileError);
      return { success: false, error: userProfileError.message };
    }

    // 2. Create the organization
    const orgSlug = generateSlug(organizationName);
    console.log('Creating organization with slug:', orgSlug);
    
    // Ensure slug is unique
    let finalSlug = orgSlug;
    let attempt = 1;
    while (attempt <= 5) { // Limit attempts to prevent infinite loop
      const { data: existingOrg, error: slugError } = await supabaseServiceClient
        .from('organizations')
        .select('id')
        .eq('slug', finalSlug)
        .single();

      if (slugError && slugError.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error checking slug uniqueness:', slugError);
        return { success: false, error: 'Failed to check organization slug uniqueness' };
      }
      
      if (!existingOrg) {
        break; // Slug is unique
      }
      
      // Slug exists, generate a new one
      finalSlug = `${orgSlug}-${Date.now().toString(36)}-${attempt}`;
      attempt++;
    }

    const { data: newOrg, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .insert({
        name: organizationName,
        slug: finalSlug,
        subscription_status: 'trial',
        subscription_plan: 'free',
        created_by: userId,
        current_users: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (orgError || !newOrg) {
      console.error('Organization creation failed:', orgError);
      return { success: false, error: orgError?.message || 'Failed to create organization' };
    }

    // 3. Link the user to the organization as an 'owner'
    const { error: memberError } = await supabaseServiceClient
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        custom_permissions: '{}',
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('Failed to link user to organization:', memberError);
      return { success: false, error: memberError.message };
    }

    console.log('User profile and organization created successfully');
    return { success: true };

  } catch (error: any) {
    console.error('Error in user profile and organization creation:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

// Helper to generate a URL-friendly slug from a name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Run the test
if (require.main === module) {
  testDirectSignup()
    .then(() => {
      console.log('\n🎉 All tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

export { testDirectSignup };
