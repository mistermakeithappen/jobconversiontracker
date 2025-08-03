import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function debugAuthIssue() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // The email from your logs
  const email = 'infoburganhomeservices@gmail.com';
  
  console.log('Debugging auth issue for email:', email);
  
  try {
    // First, find the user by email
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error listing auth users:', authError);
      return;
    }
    
    const user = authUser.users.find(u => u.email === email);
    
    if (!user) {
      console.error('❌ No auth user found with email:', email);
      return;
    }
    
    console.log('\n✓ Auth user found:');
    console.log('Auth ID:', user.id);
    console.log('Email:', user.email);
    console.log('Created at:', user.created_at);
    
    // Check if this user exists in the users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (dbError) {
      console.error('\n❌ User not found in users table:', dbError);
    } else {
      console.log('\n✓ User found in users table:', dbUser);
    }
    
    // Check organization membership
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        *,
        organizations (*)
      `)
      .eq('user_id', user.id)
      .single();
    
    if (orgError) {
      console.error('\n❌ No organization membership found:', orgError);
    } else {
      console.log('\n✓ Organization membership found:');
      console.log('Organization ID:', orgMember.organization_id);
      console.log('Role:', orgMember.role);
      console.log('Organization:', orgMember.organizations);
    }
    
    // Now let's test what happens when we decode a token
    console.log('\n📝 Testing token decoding...');
    
    // Generate a new access token for this user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: 'http://localhost:3000'
      }
    });
    
    if (sessionError) {
      console.error('Error generating session:', sessionError);
    } else {
      console.log('Generated magic link for testing');
    }
    
    // Let's also check if there are any users with similar IDs
    console.log('\n📝 Checking for any user ID mismatches...');
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', '%burganhomeservices%');
    
    console.log('Users with similar emails:', allUsers);
    
    // Check all organization members
    const { data: allOrgMembers } = await supabase
      .from('organization_members')
      .select('user_id, organization_id, role')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('\nRecent organization members:', allOrgMembers);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugAuthIssue();