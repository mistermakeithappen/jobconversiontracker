import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserForAuthUser(email: string) {
  console.log(`\nChecking for auth user with email: ${email}\n`);
  
  try {
    // First, find the auth user
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    const authUser = authUsers.find(u => u.email === email);
    if (!authUser) {
      console.error(`No auth user found with email: ${email}`);
      return;
    }

    console.log(`✅ Found auth user: ${authUser.id}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Created: ${new Date(authUser.created_at).toLocaleString()}`);

    // Check if user record exists in public.users
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking user:', userError);
      return;
    }

    if (!existingUser) {
      // Create user record
      console.log('\n❌ No user record found. Creating...');
      
      const fullName = authUser.user_metadata?.full_name || 
                      authUser.user_metadata?.fullName || 
                      email.split('@')[0];

      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email!,
          full_name: fullName
        });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return;
      }
      console.log('✅ Created user record');
    } else {
      console.log('✅ User record already exists');
    }

    // Check if user has organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', authUser.id)
      .single();

    if (memberError && memberError.code === 'PGRST116') {
      // No organization, create one
      console.log('\n❌ User has no organization. Creating...');
      
      const orgName = authUser.user_metadata?.organization_name || 
                     authUser.user_metadata?.organizationName ||
                     `${(authUser.user_metadata?.full_name || authUser.user_metadata?.fullName || email.split('@')[0])}'s Organization`;
                     
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

      console.log(`   Organization name: ${orgName}`);
      console.log(`   Organization slug: ${orgSlug}`);

      // Create the organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          subscription_status: 'trial',
          subscription_plan: 'free',
          created_by: authUser.id,
          current_users: 1
        })
        .select()
        .single();

      if (orgError) {
        console.error(`Failed to create organization:`, orgError);
        return;
      }

      console.log(`✅ Created organization: ${newOrg.id}`);

      // Add user as owner
      const { error: addMemberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: authUser.id,
          role: 'owner',
          custom_permissions: {},
          status: 'active',
          accepted_at: new Date().toISOString()
        });

      if (addMemberError) {
        console.error(`Failed to add user to organization:`, addMemberError);
      } else {
        console.log(`✅ Added user as owner of organization`);
        console.log('\n🎉 User setup complete! You should now be able to log in.');
      }
    } else if (!memberError && membership) {
      console.log(`✅ User already has organization: ${membership.organization_id}`);
      console.log('\n🎉 User is already set up! You should be able to log in.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address as argument');
  console.error('Usage: npx tsx scripts/manually-create-user.ts your-email@example.com');
  process.exit(1);
}

createUserForAuthUser(email);