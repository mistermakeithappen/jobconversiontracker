import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { getServiceSupabase } from '../lib/supabase/client';

async function checkEstimatesTable() {
  console.log('Checking ghl_estimates table...');
  
  const supabase = getServiceSupabase();
  
  // Check if the table exists
  const { data: tableInfo, error: tableError } = await supabase
    .from('ghl_estimates')
    .select('*')
    .limit(1);
    
  if (tableError) {
    console.error('Error accessing ghl_estimates table:', tableError);
    
    // Check if the migration was run
    console.log('\nChecking if migration 017 was run...');
    const { data: migrationCheck } = await supabase
      .rpc('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'ghl_estimates')
      .single();
      
    if (!migrationCheck) {
      console.log('\nThe ghl_estimates table does not exist.');
      console.log('You need to run migration 017_estimates_invoices_integration.sql');
      console.log('Run: npm run setup-db');
    }
    
    return;
  }
  
  console.log('✓ ghl_estimates table exists');
  
  // Get table structure
  const { data: columns, error: columnsError } = await supabase
    .rpc('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'ghl_estimates')
    .order('ordinal_position');
    
  if (columnsError) {
    // Fallback: check by selecting a row
    console.log('\nSample data from ghl_estimates:');
    const { data: sampleData } = await supabase
      .from('ghl_estimates')
      .select('*')
      .limit(5);
      
    if (sampleData && sampleData.length > 0) {
      console.log('Columns:', Object.keys(sampleData[0]));
      console.log('Total rows:', sampleData.length);
    } else {
      console.log('No data in ghl_estimates table yet.');
    }
  } else {
    console.log('\nTable structure:');
    columns?.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  }
  
  // Check for any existing data
  const { count } = await supabase
    .from('ghl_estimates')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nTotal estimates in database: ${count || 0}`);
}

checkEstimatesTable().catch(console.error);