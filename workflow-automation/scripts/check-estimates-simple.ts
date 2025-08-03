import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'Set' : 'Not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkEstimatesTable() {
  console.log('Checking ghl_estimates table...');
  
  // Check if the table exists
  const { data: tableInfo, error: tableError } = await supabase
    .from('ghl_estimates')
    .select('*')
    .limit(1);
    
  if (tableError) {
    console.error('Error accessing ghl_estimates table:', tableError.message);
    
    if (tableError.message.includes('does not exist')) {
      console.log('\nThe ghl_estimates table does not exist.');
      console.log('You need to run migration 017_estimates_invoices_integration.sql');
      console.log('Run: npm run setup-db');
    }
    
    return;
  }
  
  console.log('✓ ghl_estimates table exists');
  
  // Check for any existing data
  const { count } = await supabase
    .from('ghl_estimates')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total estimates in database: ${count || 0}`);
  
  // Get sample data
  const { data: sampleData } = await supabase
    .from('ghl_estimates')
    .select('*')
    .limit(5)
    .order('created_at', { ascending: false });
    
  if (sampleData && sampleData.length > 0) {
    console.log('\nSample estimate:');
    console.log(JSON.stringify(sampleData[0], null, 2));
  }
}

checkEstimatesTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });