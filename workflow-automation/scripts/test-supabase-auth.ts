import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testSupabaseAuth() {
  console.log('Testing Supabase Auth...\n');
  
  // Test with anon key (for auth operations)
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Test signup
    console.log('Testing signup...');
    const { data: signupData, error: signupError } = await supabaseAuth.auth.signUp({
      email: `test${Date.now()}@example.com`,
      password: 'testpass123',
      options: {
        data: {
          full_name: 'Test User',
        }
      }
    });

    if (signupError) {
      console.error('Signup error:', {
        message: signupError.message,
        status: signupError.status,
        code: signupError.code,
        name: signupError.name
      });
    } else {
      console.log('Signup successful:', {
        userId: signupData.user?.id,
        email: signupData.user?.email,
        emailConfirmed: signupData.user?.email_confirmed_at
      });
      
      // Clean up - delete the test user
      if (signupData.user?.id) {
        const supabaseService = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { error: deleteError } = await supabaseService.auth.admin.deleteUser(
          signupData.user.id
        );
        
        if (deleteError) {
          console.error('Failed to clean up test user:', deleteError);
        } else {
          console.log('Test user cleaned up successfully');
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseAuth();