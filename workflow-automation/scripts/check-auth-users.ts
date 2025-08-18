import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAuthUsers() {
  try {
    console.log('Checking Supabase Auth users...');
    
    // List all users in Supabase Auth
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error listing users:', error);
      return;
    }
    
    console.log('Total auth users:', users.users.length);
    
    // Find the specific user
    const targetUser = users.users.find(u => u.id === '12518c46-1422-4321-851b-bd7b467b5dbc');
    
    if (targetUser) {
      console.log('Target user found in auth:', {
        id: targetUser.id,
        email: targetUser.email,
        created_at: targetUser.created_at,
        email_confirmed_at: targetUser.email_confirmed_at,
        last_sign_in_at: targetUser.last_sign_in_at
      });
    } else {
      console.log('Target user NOT found in auth');
    }
    
    // Show first few users
    console.log('First 3 users:');
    users.users.slice(0, 3).forEach(user => {
      console.log(`- ${user.email} (${user.id}) - Created: ${user.created_at}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthUsers();
