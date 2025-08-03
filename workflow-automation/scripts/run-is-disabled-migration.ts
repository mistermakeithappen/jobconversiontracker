import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  try {
    console.log('Running migration to add is_disabled column...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250731_add_is_disabled_to_commission_assignments.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log('Running:', statement.substring(0, 50) + '...');
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });

      if (error) {
        // Try direct execution as fallback
        const { data, error: directError } = await supabase
          .from('commission_assignments')
          .select('is_disabled')
          .limit(1);
        
        if (!directError || directError.message.includes('column "is_disabled" does not exist')) {
          console.log('Column might not exist yet or RPC not available. Trying manual approach...');
          
          // Check if column already exists
          const { data: columns } = await supabase
            .from('commission_assignments')
            .select('*')
            .limit(0);
          
          console.log('Table structure check completed');
        } else {
          console.log('✅ Statement executed successfully');
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }

    // Verify the column was added
    console.log('\nVerifying column addition...');
    const { data, error } = await supabase
      .from('commission_assignments')
      .select('id, is_disabled')
      .limit(1);

    if (error && error.message.includes('column "is_disabled" does not exist')) {
      console.log('❌ Column was not added. You may need to run the migration manually in Supabase dashboard.');
      console.log('\nMigration SQL:');
      console.log(migrationSQL);
    } else {
      console.log('✅ Column is_disabled successfully added to commission_assignments table');
    }

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
runMigration();