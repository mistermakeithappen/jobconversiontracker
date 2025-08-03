import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkTableStructure() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Check if we can insert into users table
    console.log('1. Testing users table insert...');
    const testUserId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: 'structure_test@example.com',
        full_name: 'Structure Test'
      });
    
    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Check if it's a duplicate key error
      if (insertError.code === '23505') {
        console.log('User already exists, trying to delete...');
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', testUserId);
        
        if (!deleteError) {
          console.log('Deleted existing test user, retrying insert...');
          const { error: retryError } = await supabase
            .from('users')
            .insert({
              id: testUserId,
              email: 'structure_test@example.com',
              full_name: 'Structure Test'
            });
          
          if (retryError) {
            console.error('Retry insert error:', retryError);
          } else {
            console.log('✓ Insert successful on retry');
            // Clean up
            await supabase.from('users').delete().eq('id', testUserId);
          }
        }
      }
    } else {
      console.log('✓ Insert successful');
      // Clean up
      const { error: cleanupError } = await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);
      
      if (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      } else {
        console.log('✓ Cleanup successful');
      }
    }

    // Check organizations table
    console.log('\n2. Testing organizations table...');
    const { data: orgSample, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (orgError) {
      console.error('Error reading organizations:', orgError);
    } else {
      console.log('✓ Organizations table accessible');
      if (orgSample?.length) {
        console.log('Sample org columns:', Object.keys(orgSample[0]));
      }
    }

    // Check organization_members table
    console.log('\n3. Testing organization_members table...');
    const { data: membersSample, error: membersError } = await supabase
      .from('organization_members')
      .select('*')
      .limit(1);
    
    if (membersError) {
      console.error('Error reading organization_members:', membersError);
    } else {
      console.log('✓ Organization_members table accessible');
      if (membersSample?.length) {
        console.log('Sample member columns:', Object.keys(membersSample[0]));
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTableStructure();