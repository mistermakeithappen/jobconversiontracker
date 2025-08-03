import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUserApiKeysSchema() {
  console.log('Checking user_api_keys table schema...\n');
  
  // Query the information schema to get column details
  const { data: columns, error } = await supabase
    .rpc('sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_api_keys'
        ORDER BY ordinal_position;
      `
    });
    
  if (error) {
    console.error('Error fetching schema:', error);
    
    // Try a simpler approach - just select from the table
    console.log('\nTrying direct select...');
    const { data: testSelect, error: selectError } = await supabase
      .from('user_api_keys')
      .select('*')
      .limit(0);
      
    if (selectError) {
      console.error('Select error:', selectError);
    } else {
      console.log('Table exists! Columns:', Object.keys(testSelect || {}));
    }
    return;
  }
  
  console.log('user_api_keys table columns:');
  columns?.forEach((col: any) => {
    console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
  });
  
  // Also check if the table exists at all
  console.log('\nChecking if table exists...');
  const { data: tableExists, error: tableError } = await supabase
    .from('user_api_keys')
    .select('count')
    .limit(0);
    
  if (tableError) {
    console.error('Table does not exist or error:', tableError);
  } else {
    console.log('Table exists!');
  }
}

checkUserApiKeysSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });