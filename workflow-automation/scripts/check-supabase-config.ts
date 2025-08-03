import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkSupabaseConfig() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Check if the handle_new_user function exists
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'handle_new_user')
      .single();
    
    console.log('handle_new_user function exists:', !!functions);
    
    // Check if the trigger exists
    const { data: triggers, error: trigError } = await supabase
      .from('pg_trigger')
      .select('tgname')
      .eq('tgname', 'on_auth_user_created')
      .single();
    
    console.log('on_auth_user_created trigger exists:', !!triggers);
    
    // Try to manually test the trigger function
    console.log('\nTesting handle_new_user function manually...');
    const { data, error } = await supabase.rpc('handle_new_user', {
      new: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'test@example.com',
        raw_user_meta_data: {
          full_name: 'Test User',
          organization_name: 'Test Org'
        }
      }
    });
    
    if (error) {
      console.error('Error testing handle_new_user:', error);
    } else {
      console.log('handle_new_user test successful');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkSupabaseConfig();