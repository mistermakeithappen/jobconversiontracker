import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkAuthTrigger() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Checking auth trigger setup...\n');

  try {
    // Test creating a user with minimal data
    console.log('1. Testing minimal auth signup...');
    const email = `test_${Date.now()}@example.com`;
    
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: 'testpass123'
    });

    if (error) {
      console.error('Minimal signup failed:', {
        message: error.message,
        status: error.status,
        code: error.code
      });
      
      // If it's still the database error, the trigger is the issue
      if (error.message === 'Database error saving new user') {
        console.log('\n⚠️  The auth trigger is causing the error.');
        console.log('The handle_new_user() function in migration 012 needs to be fixed.\n');
        
        console.log('Possible issues:');
        console.log('1. The trigger might be trying to insert duplicate data');
        console.log('2. Required columns might be missing');
        console.log('3. The trigger might have permission issues');
      }
    } else {
      console.log('✓ Signup successful!');
      console.log('User ID:', data.user?.id);
      
      // Clean up
      if (data.user?.id) {
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('✓ Test user cleaned up');
      }
    }

    // Note: Direct function checks require special permissions
    console.log('\n2. Auth trigger is likely the cause of signup failures.');
    console.log('The handle_new_user() function needs to be debugged in Supabase.');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAuthTrigger();