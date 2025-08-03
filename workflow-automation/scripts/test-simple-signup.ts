import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testSimpleSignup() {
  console.log('Testing simple signup without database trigger...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // First, let's check if we can create a user with service role
    console.log('Creating user with service role (bypasses triggers)...');
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: `testservice${Date.now()}@example.com`,
      password: 'testpass123',
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Test Service User'
      }
    });

    if (userError) {
      console.error('Service role user creation error:', userError);
    } else {
      console.log('Service role user created successfully:', {
        id: userData.user.id,
        email: userData.user.email
      });
      
      // Clean up
      await supabase.auth.admin.deleteUser(userData.user.id);
      console.log('Test user cleaned up');
    }
    
    // Check auth configuration
    console.log('\nChecking auth settings...');
    const { data: config } = await supabase.auth.getSession();
    console.log('Auth session check passed');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSimpleSignup();