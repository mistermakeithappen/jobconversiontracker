import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runMigration() {
  console.log('🔧 Running MCP API key reference migration...');
  
  try {
    const migrationSql = fs.readFileSync('./supabase/migrations/20250730_add_mcp_api_key_reference.sql', 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
    
    if (error) {
      console.log('❌ Migration failed:', error.message);
    } else {
      console.log('✅ Migration completed successfully');
    }
    
    // Verify the changes
    console.log('\n🔍 Verifying migration...');
    
    // Check if column was added
    const { data: columns } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'integrations' 
        AND column_name = 'mcp_api_key_id'
      `
    });
    
    if (columns && columns.length > 0) {
      console.log('✅ mcp_api_key_id column added to integrations table');
    } else {
      console.log('❌ mcp_api_key_id column not found');
    }
    
    // Check provider constraint
    const { data: constraints } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_api_keys_provider_check'
        AND table_name = 'user_api_keys'
      `
    });
    
    if (constraints && constraints.length > 0) {
      console.log('✅ Provider constraint updated');
    } else {
      console.log('❌ Provider constraint not found');
    }
    
  } catch (error) {
    console.log('❌ Migration error:', error);
  }
}

runMigration().catch(console.error);