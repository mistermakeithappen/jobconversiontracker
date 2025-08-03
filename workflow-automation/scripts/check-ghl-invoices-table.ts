import { getServiceSupabase } from '../lib/auth/production-auth-server';

async function checkInvoicesTable() {
  console.log('Checking if ghl_invoices table exists...');
  
  const supabase = getServiceSupabase();
  
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('ghl_invoices')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error querying ghl_invoices table:', error);
      console.log('\nThe ghl_invoices table does not exist or has permission issues.');
      console.log('Please run the migration: supabase/migrations/017_estimates_invoices_integration.sql');
      return false;
    }
    
    console.log('✅ ghl_invoices table exists');
    
    // Check table structure
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'ghl_invoices' });
    
    if (!columnsError && columns) {
      console.log('\nTable columns:', columns.map((c: any) => c.column_name).join(', '));
    }
    
    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Create the RPC function if it doesn't exist
async function createColumnCheckFunction() {
  const supabase = getServiceSupabase();
  
  const { error } = await supabase.rpc('run_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
      RETURNS TABLE(column_name text, data_type text)
      LANGUAGE sql
      SECURITY DEFINER
      AS $$
        SELECT column_name::text, data_type::text
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      $$;
    `
  }).single();
  
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating helper function:', error);
  }
}

async function main() {
  await createColumnCheckFunction();
  await checkInvoicesTable();
}

main().catch(console.error);