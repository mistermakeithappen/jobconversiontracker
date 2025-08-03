import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMetadataMigration() {
  console.log('🚀 Running integration metadata migration...\n');
  
  // Check if metadata column already exists
  const { data: columns, error: columnsError } = await supabase
    .from('integrations')
    .select('*')
    .limit(1);
    
  if (columnsError) {
    console.error('Error checking columns:', columnsError);
    return;
  }
  
  if (columns && columns.length > 0 && 'metadata' in columns[0]) {
    console.log('✅ Metadata column already exists!');
    return;
  }
  
  console.log('❌ Metadata column does not exist.');
  console.log('\n📝 Please run the following migration manually in Supabase SQL Editor:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new');
  console.log('   2. Copy and paste the migration SQL below');
  console.log('   3. Click "Run"\n');
  
  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250730_add_integration_metadata.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('=== Migration SQL ===');
  console.log(migrationSQL);
  console.log('=== End Migration SQL ===\n');
  
  console.log('After running the migration, you can run the populate script to migrate existing data.');
}

// Run the script
runMetadataMigration().catch(console.error);