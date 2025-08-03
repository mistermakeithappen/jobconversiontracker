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

  // Get all migration files in order
  const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('MIGRATION_ORDER'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files to run:\n`);
  migrationFiles.forEach(f => console.log(`  - ${f}`));
  console.log();

  // Combine all migrations
  let combinedSQL = '';
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    combinedSQL += `\n-- ========================================\n`;
    combinedSQL += `-- Migration: ${file}\n`;
    combinedSQL += `-- ========================================\n`;
    combinedSQL += content;
    combinedSQL += `\n\n`;
  }

  // Since we can't execute raw SQL through the client, we'll need to use Supabase Dashboard
  console.log('📋 Database setup instructions:\n');
  console.log('1. Open Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n`);
  console.log('2. The combined migrations have been saved to a file (see below)\n');
  console.log('3. Copy the file content and paste it in the SQL editor\n');
  console.log('4. Click "Run" to execute all migrations\n');
  console.log('5. After running the migrations, the database will be fully set up\n');
  
  // Create a file with the migration for easy copying
  const outputPath = path.join(process.cwd(), 'scripts/all-migrations-combined.sql');
  fs.writeFileSync(outputPath, combinedSQL);
  console.log(`💾 Combined migrations saved to: ${outputPath}`);
  console.log('   You can copy this file content to the Supabase SQL editor.\n');
  
  // Show specific instructions for the auth trigger
  console.log('⚠️  IMPORTANT: The auth trigger (migration 012) is critical for new user signup.');
  console.log('   This trigger automatically creates organizations for new users.');
  console.log('   Without it, users can sign up but cannot log in.\n');
}

setupDatabase().catch(console.error);