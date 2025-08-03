import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkUserApiKeysStructure() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Checking user_api_keys table structure...\n');

  try {
    // Query the information schema to get column details
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: 'user_api_keys' });
    
    if (error) {
      // Try alternative approach
      const { data: columns, error: colError } = await supabase
        .from('user_api_keys')
        .select()
        .limit(0);
      
      if (colError) {
        console.error('Error checking columns:', colError);
      } else {
        // Get column names from the query structure
        console.log('user_api_keys table exists');
        console.log('Attempting to insert test record to see column structure...');
        
        // Try to insert a dummy record to see what columns exist
        const { error: insertError } = await supabase
          .from('user_api_keys')
          .insert({
            id: '00000000-0000-0000-0000-000000000000',
            organization_id: '00000000-0000-0000-0000-000000000000',
            provider: 'openai',
            encrypted_key: 'test',
            is_active: false
          });
        
        if (insertError) {
          console.log('\nColumn structure based on error:', insertError.message);
          
          // Check if it mentions user_id
          if (insertError.message.includes('user_id')) {
            console.log('\n❌ Table has user_id column, not organization_id');
          } else if (insertError.message.includes('organization_id')) {
            console.log('\n✓ Table has organization_id column');
          }
        }
      }
    } else {
      console.log('Table columns:', data);
    }
  } catch (e) {
    console.error('Failed to check table structure:', e);
  }
}

checkUserApiKeysStructure();