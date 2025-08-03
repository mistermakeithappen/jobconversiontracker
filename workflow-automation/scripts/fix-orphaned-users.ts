import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixOrphanedUsers() {
  console.log('Checking for users without organizations...\n');

  try {
    // First, let's check if there are any users without organizations
    const { data: orphanedUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (checkError) {
      console.error('Error checking users:', checkError);
      return;
    }

    if (!orphanedUsers || orphanedUsers.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${orphanedUsers.length} total users`);

    // Check which users don't have organizations
    for (const user of orphanedUsers) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (memberError && memberError.code === 'PGRST116') {
        // User has no organization
        console.log(`\n❌ User ${user.email} (${user.id}) has NO organization`);
        
        // Create organization for this user
        const orgName = user.full_name ? `${user.full_name}'s Organization` : `${user.email.split('@')[0]}'s Organization`;
        let orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        
        // Ensure unique slug
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select('slug')
          .eq('slug', orgSlug)
          .single();
          
        if (existingOrg) {
          orgSlug = `${orgSlug}-${Date.now()}`;
        }

        console.log(`Creating organization "${orgName}" with slug "${orgSlug}"...`);

        // Create the organization
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: orgName,
            slug: orgSlug,
            subscription_status: 'trial',
            subscription_plan: 'free',
            created_by: user.id,
            current_users: 1
          })
          .select()
          .single();

        if (orgError) {
          console.error(`Failed to create organization:`, orgError);
          continue;
        }

        console.log(`✅ Created organization: ${newOrg.id}`);

        // Add user as owner
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: newOrg.id,
            user_id: user.id,
            role: 'owner',
            custom_permissions: {},
            status: 'active',
            accepted_at: new Date().toISOString()
          });

        if (memberError) {
          console.error(`Failed to add user to organization:`, memberError);
        } else {
          console.log(`✅ Added user as owner of organization`);
        }
      } else if (!memberError && membership) {
        console.log(`✅ User ${user.email} has organization: ${membership.organization_id}`);
      }
    }

    // Now let's run the migration to ensure the trigger exists
    console.log('\n\nChecking if auth trigger needs to be created...');
    
    // Try to run the migration
    const migrationSql = `
-- Create a function that automatically creates user records and organization when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_full_name TEXT;
BEGIN
  -- Get full name from raw_user_meta_data or use email
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  
  -- Generate organization name and slug
  org_name := COALESCE(
    new.raw_user_meta_data->>'organization_name',
    user_full_name || '''s Organization'
  );
  
  org_slug := lower(regexp_replace(org_name, '[^a-z0-9]+', '-', 'g'));
  org_slug := regexp_replace(org_slug, '^-+|-+$', '', 'g');
  
  -- Ensure slug is unique
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END LOOP;

  -- Insert user record
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, user_full_name)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Only create organization if user doesn't have one
  IF NOT EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = new.id
  ) THEN
    -- Create organization
    INSERT INTO organizations (
      name,
      slug,
      subscription_status,
      subscription_plan,
      created_by
    )
    VALUES (
      org_name,
      org_slug,
      'trial',
      'free',
      new.id
    )
    RETURNING id INTO org_id;

    -- Add user as owner
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      custom_permissions,
      status,
      accepted_at
    )
    VALUES (
      org_id,
      new.id,
      'owner',
      '{}'::jsonb,
      'active',
      NOW()
    );

    -- Update organization user count
    UPDATE organizations 
    SET current_users = 1
    WHERE id = org_id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (in case user confirms email later)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
`;

    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSql
    }).single();

    if (migrationError) {
      console.log('Could not create trigger via RPC. This is expected - the trigger may already exist or need to be created via migration.');
      console.log('\nTo ensure the trigger exists, run: npm run setup-db');
    } else {
      console.log('✅ Successfully created auth trigger!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixOrphanedUsers();