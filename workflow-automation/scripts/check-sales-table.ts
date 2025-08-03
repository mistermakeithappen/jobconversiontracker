import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTable() {
  console.log('Checking sales_transactions table...\n');
  
  const { data, error } = await supabase
    .from('sales_transactions')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log('Error:', error.message);
    console.log('\nTable may not exist. You need to run the migration:');
    console.log('workflow-automation/supabase/migrations/20250229_sales_tracking_system.sql');
  } else {
    console.log('✓ Table exists');
    
    // Check record count
    const { count } = await supabase
      .from('sales_transactions')
      .select('*', { count: 'exact', head: true });
      
    console.log(`Found ${count || 0} records in the table`);
  }
}

checkTable().catch(console.error);