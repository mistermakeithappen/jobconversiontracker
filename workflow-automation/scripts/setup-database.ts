import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Function to execute SQL using Supabase REST API
async function executeSql(sql: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL execution failed: ${error}`);
  }

  return response.json();
}

async function setupDatabase() {
  console.log('🚀 Setting up database...\n');

  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250125_initial_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Since we can't execute raw SQL through the client, we'll need to use Supabase Dashboard
  console.log('📋 Database setup instructions:\n');
  console.log('1. Open Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n`);
  console.log('2. Copy and paste the following SQL:\n');
  console.log('-- START OF SQL --');
  console.log(migrationSQL);
  console.log('-- END OF SQL --\n');
  console.log('3. Click "Run" to execute the migration\n');
  console.log('4. After running the migration, execute: npm run init-db\n');
  
  // Create a file with the migration for easy copying
  const outputPath = path.join(process.cwd(), 'scripts/migration-to-run.sql');
  fs.writeFileSync(outputPath, migrationSQL);
  console.log(`💾 Migration SQL saved to: ${outputPath}`);
  console.log('   You can copy this file content to the Supabase SQL editor.\n');
}

setupDatabase().catch(console.error);