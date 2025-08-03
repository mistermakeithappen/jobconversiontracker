import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    const migrationSql = readFileSync('supabase/migrations/017_estimates_invoices_integration.sql', 'utf-8');
    
    console.log('Running estimates/invoices integration migration...');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { 
      sql: migrationSql 
    });
    
    if (error) {
      console.error('Migration error:', error);
      return;
    }
    
    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('Script error:', err);
  }
}

runMigration();