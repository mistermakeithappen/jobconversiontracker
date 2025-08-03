import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSalesMigration() {
  try {
    console.log('🚀 Running sales tracking system migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250229_sales_tracking_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('🔧 Executing migration...\n');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec', { sql: migrationSQL });
    
    if (error) {
      // If the RPC doesn't exist, try a different approach
      console.log('⚠️  Direct execution not available. Please run the following SQL in Supabase SQL Editor:');
      console.log('\nhttps://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n');
      console.log('-- START OF SQL --');
      console.log(migrationSQL);
      console.log('-- END OF SQL --');
      
      // Save to file for easy copying
      const outputPath = path.join(process.cwd(), 'scripts/sales-migration-to-run.sql');
      fs.writeFileSync(outputPath, migrationSQL);
      console.log(`\n💾 Migration SQL saved to: ${outputPath}`);
      console.log('   You can copy this file content to the Supabase SQL editor.');
    } else {
      console.log('✅ Migration executed successfully!');
      
      // Verify tables were created
      const tables = ['ghl_products', 'sales_transactions', 'commission_calculations', 'commission_payouts'];
      
      for (const table of tables) {
        const { error: checkError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (checkError) {
          console.log(`❌ Table ${table} - NOT CREATED`);
        } else {
          console.log(`✅ Table ${table} - CREATED`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

runSalesMigration().catch(console.error);