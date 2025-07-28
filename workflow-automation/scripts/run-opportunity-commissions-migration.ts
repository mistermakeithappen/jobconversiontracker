import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // First check if update_updated_at_column function exists
  const { error: functionCheckError } = await supabase.rpc('update_updated_at_column', {});
  
  if (functionCheckError && functionCheckError.message.includes('does not exist')) {
    console.log('Creating update_updated_at_column function...');
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
    `;
    
    const { error: createFunctionError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    if (createFunctionError) {
      console.error('Error creating function:', createFunctionError);
    }
  }

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250214_opportunity_commissions.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running opportunity_commissions migration...');

  // Since we can't execute raw SQL directly, we'll need to run it through Supabase Studio
  // or use a different approach
  console.log('\n=== MIGRATION SQL ===');
  console.log(migrationSQL);
  console.log('\n=== END MIGRATION ===');

  console.log('\nTo run this migration:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Navigate to the SQL Editor');
  console.log('3. Copy and paste the SQL above');
  console.log('4. Click "Run"');
  console.log('\nAlternatively, you can run:');
  console.log(`npx supabase db push --db-url "${supabaseUrl.replace('https://', 'postgresql://postgres:')}<YOUR_DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"`);
}

runMigration().catch(console.error);