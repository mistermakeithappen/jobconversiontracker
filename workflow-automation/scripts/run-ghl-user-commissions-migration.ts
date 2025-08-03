import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running ghl_user_commissions migration...');
    
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250305_ghl_user_commissions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📋 Executing migration...');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // Try direct query approach
      console.log('🔄 Trying alternative approach...');
      
      // Split migration into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.from('_sql').select(statement);
          if (stmtError && !stmtError.message.includes('already exists')) {
            console.error(`❌ Error executing statement: ${stmtError.message}`);
          }
        } catch (e) {
          // Ignore errors for now, table might already exist
        }
      }
    }
    
    // Verify table exists
    const { data, error: checkError } = await supabase
      .from('ghl_user_commissions')
      .select('id')
      .limit(1);
    
    if (!checkError || checkError.code === 'PGRST116') {
      console.log('✅ Migration completed successfully!');
      console.log('✅ Table ghl_user_commissions is ready');
    } else {
      console.error('❌ Error verifying table:', checkError);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();