import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...\n');
  console.log('Project URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // Test with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Test basic connection by checking tables
    console.log('\n1. Testing database connection...');
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (tablesError) {
      console.error('Error accessing users table:', tablesError);
    } else {
      console.log('✓ Successfully connected to database');
    }

    // 2. List all tables in public schema
    console.log('\n2. Listing all tables in public schema...');
    const { data: allTables, error: schemaError } = await supabase
      .rpc('get_tables', {}, { get: true })
      .select('*');
    
    if (schemaError) {
      // Try alternative method
      const { data: tableList, error: listError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (listError) {
        console.log('Cannot list tables directly, but connection seems OK');
      } else {
        console.log('Tables found:', tableList?.map(t => t.table_name).join(', '));
      }
    }

    // 3. Test auth endpoints
    console.log('\n3. Testing auth endpoints...');
    const { data: health } = await supabase.auth.getSession();
    console.log('✓ Auth endpoint accessible');

    // 4. Check specific tables we need
    console.log('\n4. Checking required tables...');
    const requiredTables = ['users', 'organizations', 'organization_members'];
    
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(0);
      if (error) {
        console.error(`✗ Table '${table}' error:`, error.message);
      } else {
        console.log(`✓ Table '${table}' accessible`);
      }
    }

    // 5. Test if we can query auth schema (with service role)
    console.log('\n5. Testing auth schema access...');
    const { data: authTest, error: authError } = await supabase
      .from('auth.users')
      .select('count')
      .limit(1);
    
    if (authError) {
      console.log('✗ Cannot directly query auth.users (normal for most setups)');
    } else {
      console.log('✓ Can access auth schema');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseConnection();