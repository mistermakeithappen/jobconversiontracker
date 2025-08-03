import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkNewUser() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = 'infoburganhomeservices@gmail.com';
  
  try {
    // Check if user exists in auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = authUsers?.users.find(u => u.email === email);
    
    if (authUser) {
      console.log('Auth user found:', {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at,
        metadata: authUser.user_metadata
      });
      
      // Check if user exists in users table
      const { data: dbUsers, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id);
      
      if (dbError) {
        console.error('\n❌ Error querying users table:', dbError.message);
      } else if (!dbUsers || dbUsers.length === 0) {
        console.error('\n❌ User NOT found in users table');
      } else {
        console.log(`\n✓ User found in users table (${dbUsers.length} records):`, dbUsers);
      }
      
      // Check organization membership
      const { data: memberships, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organizations!inner(*)
        `)
        .eq('user_id', authUser.id);
      
      if (memberError) {
        console.error('\n❌ Error querying organization membership:', memberError.message);
      } else if (!memberships || memberships.length === 0) {
        console.error('\n❌ No organization membership found');
      } else {
        console.log(`\n✓ Organization membership found (${memberships.length} records):`, memberships);
      }
    } else {
      console.log('No auth user found with email:', email);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkNewUser();