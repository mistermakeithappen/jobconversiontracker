import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250125_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('Migration failed:', error);
      
      // If RPC doesn't exist, try a different approach
      if (error.code === 'PGRST202') {
        console.log('Trying alternative approach...');
        
        // Split the SQL into individual statements
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          
          // Note: Supabase JS client doesn't support raw SQL execution
          // You'll need to run this through Supabase dashboard or CLI
          console.log('Please run this statement in Supabase SQL Editor:');
          console.log(statement + ';');
          console.log('---');
        }
        
        console.log('\nTo run the migration:');
        console.log('1. Go to https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new');
        console.log('2. Copy and paste the migration SQL from supabase/migrations/20250125_initial_schema.sql');
        console.log('3. Click "Run" to execute the migration');
      }
    } else {
      console.log('Migration completed successfully!');
    }
  } catch (err) {
    console.error('Error running migration:', err);
  }
}

runMigration();