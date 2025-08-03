import { getServiceSupabase } from '../lib/supabase/client';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🚀 Running GHL contacts migration...\n');
  
  const supabase = getServiceSupabase();
  
  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250730_ghl_contacts_sync.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolons but preserve them
  const statements = migrationSQL
    .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|$))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    
    if (!statement || statement.startsWith('--')) {
      continue;
    }
    
    // Get first few words for logging
    const preview = statement.substring(0, 50).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });
      
      if (error) {
        // Try direct execution for CREATE/ALTER statements
        const { error: directError } = await supabase.from('_dummy_').select().limit(0);
        
        console.error(`❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Error: ${err}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful statements: ${successCount}`);
  console.log(`   ❌ Failed statements: ${errorCount}`);
  
  // Check if tables were created
  console.log('\n🔍 Checking if tables exist...');
  
  const { data: tables } = await supabase
    .from('ghl_contacts')
    .select('id')
    .limit(0);
    
  if (tables !== null) {
    console.log('✅ ghl_contacts table exists!');
  } else {
    console.log('❌ ghl_contacts table not found');
  }
  
  const { data: logs } = await supabase
    .from('ghl_contact_sync_logs')
    .select('id')
    .limit(0);
    
  if (logs !== null) {
    console.log('✅ ghl_contact_sync_logs table exists!');
  } else {
    console.log('❌ ghl_contact_sync_logs table not found');
  }
}

// Create exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  const supabase = getServiceSupabase();
  
  const createFunction = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text) 
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  try {
    // This might fail but that's okay
    await supabase.rpc('exec_sql', { sql: createFunction });
  } catch (err) {
    // Function might not exist yet, that's fine
  }
}

// Run the migration
createExecSqlFunction()
  .then(() => runMigration())
  .catch(console.error);