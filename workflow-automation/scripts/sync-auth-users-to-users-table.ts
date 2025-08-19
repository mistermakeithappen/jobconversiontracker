#!/usr/bin/env tsx

/**
 * Sync Auth Users to Users Table Script
 * 
 * This script syncs all existing users from Supabase Auth (auth.users) 
 * to the public.users table, since the automatic trigger isn't working 
 * for users who signed up before the trigger was created.
 * 
 * It also creates organizations and organization members for users who don't have them.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  raw_user_meta_data: any;
}

interface PublicUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

async function syncAuthUsersToUsersTable() {
  console.log('🔄 Starting sync of auth users to users table...\n');

  try {
    // 1. Get all users from Supabase Auth
    console.log('1. Fetching users from Supabase Auth...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return false;
    }

    console.log(`✅ Found ${authUsers.users.length} users in auth.users table\n`);

    // 2. Get existing users from public.users table
    console.log('2. Checking existing users in public.users table...');
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('id, email');

    if (existingError) {
      console.error('❌ Error fetching existing users:', existingError);
      return false;
    }

    const existingUserIds = new Set(existingUsers?.map(u => u.id) || []);
    console.log(`✅ Found ${existingUserIds.size} existing users in public.users table\n`);

    // 3. Identify users that need to be synced
    const usersToSync = authUsers.users.filter(user => !existingUserIds.has(user.id));
    console.log(`3. Found ${usersToSync.length} users that need to be synced\n`);

    if (usersToSync.length === 0) {
      console.log('🎉 All users are already synced!');
      return true;
    }

    // 4. Sync users to public.users table
    console.log('4. Syncing users to public.users table...');
    let syncedCount = 0;
    let errorCount = 0;

    for (const authUser of usersToSync) {
      try {
        const fullName = getFullName(authUser);
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email,
            full_name: fullName,
            avatar_url: authUser.raw_user_meta_data?.avatar_url || null,
            created_at: authUser.created_at,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`❌ Failed to sync user ${authUser.email}:`, insertError);
          errorCount++;
        } else {
          console.log(`✅ Synced user: ${authUser.email} (${fullName})`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`❌ Error syncing user ${authUser.email}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Sync Results:`);
    console.log(`- Successfully synced: ${syncedCount} users`);
    console.log(`- Errors: ${errorCount} users`);
    console.log(`- Total processed: ${usersToSync.length} users\n`);

    // 5. Check and create organizations for synced users
    if (syncedCount > 0) {
      console.log('5. Checking organizations for synced users...');
      await ensureOrganizationsForUsers(usersToSync);
    }

    console.log('🎉 User sync completed!');
    return errorCount === 0;

  } catch (error) {
    console.error('❌ Sync failed:', error);
    return false;
  }
}

async function ensureOrganizationsForUsers(authUsers: AuthUser[]) {
  let orgCreatedCount = 0;
  let memberAddedCount = 0;

  for (const authUser of authUsers) {
    try {
      // Check if user already has an organization
      const { data: existingMembership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', authUser.id)
        .single();

      if (existingMembership) {
        console.log(`ℹ️  User ${authUser.email} already has organization membership`);
        continue;
      }

      // Create organization for user
      const orgName = getOrganizationName(authUser);
      const orgSlug = generateSlug(orgName);
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          subscription_status: 'trial',
          subscription_plan: 'free',
          created_by: authUser.id
        })
        .select()
        .single();

      if (orgError) {
        console.error(`❌ Failed to create organization for ${authUser.email}:`, orgError);
        continue;
      }

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: authUser.id,
          role: 'owner',
          custom_permissions: '{}',
          status: 'active',
          accepted_at: new Date().toISOString()
        });

      if (memberError) {
        console.error(`❌ Failed to add user as organization member:`, memberError);
        continue;
      }

      // Update organization user count
      await supabase
        .from('organizations')
        .update({ current_users: 1 })
        .eq('id', org.id);

      console.log(`✅ Created organization "${orgName}" for user ${authUser.email}`);
      orgCreatedCount++;
      memberAddedCount++;

    } catch (error) {
      console.error(`❌ Error setting up organization for ${authUser.email}:`, error);
    }
  }

  console.log(`\n🏢 Organization Setup Results:`);
  console.log(`- Organizations created: ${orgCreatedCount}`);
  console.log(`- Members added: ${memberAddedCount}`);
}

function getFullName(authUser: AuthUser): string {
  if (authUser.raw_user_meta_data?.full_name) {
    return authUser.raw_user_meta_data.full_name;
  }
  
  if (authUser.email) {
    const emailPrefix = authUser.email.split('@')[0];
    // Convert email prefix to title case
    return emailPrefix
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  return 'Unknown User';
}

function getOrganizationName(authUser: AuthUser): string {
  if (authUser.raw_user_meta_data?.organization_name) {
    return authUser.raw_user_meta_data.organization_name;
  }
  
  const fullName = getFullName(authUser);
  return `${fullName}'s Organization`;
}

function generateSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Ensure slug is not empty
  if (!slug) {
    slug = 'organization';
  }
  
  return slug;
}

// Run the sync
if (require.main === module) {
  syncAuthUsersToUsersTable()
    .then(success => {
      if (success) {
        console.log('\n🎉 All users successfully synced!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Sync completed with some errors. Check the logs above.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Sync failed:', error);
      process.exit(1);
    });
}

export { syncAuthUsersToUsersTable };
