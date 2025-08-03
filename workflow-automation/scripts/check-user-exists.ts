import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUser() {
  const email = 'infoburganhomeservices@gmail.com';
  
  try {
    // Check auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Error listing auth users:', authError);
    } else {
      const existingAuthUser = authUsers?.users.find(u => u.email === email);
      if (existingAuthUser) {
        console.log('Auth user found:', {
          id: existingAuthUser.id,
          email: existingAuthUser.email,
          created_at: existingAuthUser.created_at
        });
      } else {
        console.log('No auth user found with email:', email);
      }
    }
    
    // Check database users
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (dbError) {
      console.error('Error checking DB users:', dbError);
    } else {
      console.log('DB users found:', dbUsers);
    }
    
    // Check organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('name', 'Burgan Home Services');
    
    if (orgError) {
      console.error('Error checking organizations:', orgError);
    } else {
      console.log('Organizations found:', orgs);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUser();