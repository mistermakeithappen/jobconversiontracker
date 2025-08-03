import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Running invoices migration...\n');
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '017_estimates_invoices_integration.sql');
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Executing migration: 017_estimates_invoices_integration.sql');
    
    // Split the SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          // Try direct execution if exec_sql doesn't exist
          const { error: directError } = await supabase.from('_sql').insert({ query: statement });
          
          if (directError) {
            console.error(`❌ Error executing statement: ${directError.message}`);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error: ${err}`);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Migration complete: ${successCount} statements succeeded, ${errorCount} failed`);
    
    // Check if the table was created
    const { error: checkError } = await supabase
      .from('ghl_invoices')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ ghl_invoices table created successfully!');
    } else {
      console.error('❌ ghl_invoices table not found:', checkError.message);
    }
    
  } catch (error) {
    console.error('Failed to read migration file:', error);
  }
}

// Create exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `
  });
  
  if (error && !error.message.includes('already exists')) {
    console.log('Note: exec_sql function could not be created, will try direct execution');
  }
}

async function main() {
  await createExecSqlFunction();
  await runMigration();
}

main().catch(console.error);