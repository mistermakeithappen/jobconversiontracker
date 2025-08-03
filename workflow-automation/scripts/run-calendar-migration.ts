import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250731_ghl_calendars.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Running GHL calendars migration...');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });
      
      if (error) {
        // Try direct execution if exec_sql doesn't exist
        console.log('exec_sql failed, trying direct query...');
        const { error: directError } = await supabase.from('_sql').select(statement);
        
        if (directError) {
          console.error('Error executing statement:', directError);
          // Continue with other statements
        }
      }
    }
    
    // Verify table creation
    const { data, error } = await supabase
      .from('ghl_calendars')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error verifying table:', error);
    } else {
      console.log('✅ GHL calendars table created successfully!');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigration().catch(console.error);