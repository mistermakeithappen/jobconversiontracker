import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyTables() {
  console.log('Verifying sales tracking tables...\n');
  
  const tables = [
    'ghl_products',
    'sales_transactions', 
    'commission_calculations',
    'commission_payouts',
    'payout_line_items'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(`❌ ${table} - NOT FOUND (${error.message})`);
      } else {
        console.log(`✅ ${table} - EXISTS (${count || 0} records)`);
      }
    } catch (err) {
      console.log(`❌ ${table} - ERROR checking`);
    }
  }
  
  // Check if ghl_products has data (we know this should have 21 records)
  const { count: productCount } = await supabase
    .from('ghl_products')
    .select('*', { count: 'exact', head: true });
    
  if (productCount && productCount > 0) {
    console.log(`\n✅ ghl_products table is working correctly with ${productCount} products`);
  }
}

verifyTables().catch(console.error);