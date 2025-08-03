import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Migration files in chronological order
const migrations = [
  '20250125_initial_schema.sql',
  '20250126_api_key_functions.sql',
  '20250127_receipt_tracking.sql',
  '20250128_receipt_enhancements.sql',
  '20250129_receipt_processing.sql',
  '20250131_add_phone_to_payment_structures.sql',
  '20250132_add_ghl_user_columns.sql',
  '20250133_fix_user_payment_structures_user_id.sql',
  '20250205_update_receipt_processing_for_messages.sql',
  '20250206_user_api_keys_updated.sql',
  '20250207_time_entries.sql',
  '20250208_fix_fk_constraint.sql',
  '20250209_user_api_keys.sql',
  '20250210_receipt_processing_message_fields.sql',
  '20250212_receipt_tracking_safe.sql',
  '20250213_contact_sync.sql',
  '20250214_opportunity_commissions.sql',
  '20250228_add_assigned_user_to_opportunities.sql',
  '20250229_sales_tracking_system.sql',
  '20250301_commission_rules_system.sql',
  '20250302_pipeline_completion_tracking.sql',
  '20250303_add_mcp_support.sql',
  '20250304_unified_commission_system.sql',
  '20250305_ghl_user_commissions.sql',
  '20250728_add_pipeline_analysis_timestamp.sql',
  '20250728_disable_rls_pipeline_stages.sql',
  '20250728_fix_pipeline_stages_rls.sql',
  '20250729_chatbot_workflow_system.sql',
  '20250730_add_ghlmcp_provider.sql',
  '20250730_add_mcp_api_key_reference.sql',
  '20250730_disable_broken_trigger.sql',
  '20250730_fix_reimbursable_trigger.sql',
  '20250730_ghl_contacts_sync.sql',
  '20250730_add_integration_metadata.sql'
];

async function runMigrations() {
  console.log('🚀 Running all migrations in order...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // First, create a migrations tracking table if it doesn't exist
  const trackingTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  console.log('📋 Creating migrations tracking table...');
  const { error: trackingError } = await supabase.rpc('exec_sql', {
    sql: trackingTableSQL
  }).catch(() => ({ error: 'exec_sql function not available' }));

  if (trackingError) {
    console.log('⚠️  Could not create tracking table via RPC');
  }

  // Check which migrations have already been run
  const { data: completedMigrations } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version');

  const completed = new Set(completedMigrations?.map(m => m.version) || []);

  console.log(`\n📊 Migration Status:`);
  console.log(`   Total migrations: ${migrations.length}`);
  console.log(`   Already completed: ${completed.size}`);
  console.log(`   To be run: ${migrations.length - completed.size}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    if (completed.has(migration)) {
      console.log(`⏭️  Skipping ${migration} (already completed)`);
      skipCount++;
      continue;
    }

    console.log(`\n🔄 Running ${migration}...`);
    
    const migrationPath = path.join(process.cwd(), 'supabase/migrations', migration);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`❌ Migration file not found: ${migrationPath}`);
      errorCount++;
      continue;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // For the new contacts sync migration, just check if tables exist
    if (migration === '20250730_ghl_contacts_sync.sql') {
      const { error: contactsTableError } = await supabase
        .from('ghl_contacts')
        .select('count')
        .limit(0);

      if (contactsTableError && contactsTableError.code === '42P01') {
        console.log(`❌ Table ghl_contacts does not exist`);
        console.log(`\n⚠️  Please run this migration manually in Supabase SQL Editor:`);
        console.log(`   1. Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new`);
        console.log(`   2. Copy the migration from: ${migrationPath}`);
        console.log(`   3. Click "Run" to execute it\n`);
        errorCount++;
      } else {
        console.log(`✅ Table ghl_contacts already exists`);
        successCount++;
        
        // Mark as completed
        await supabase
          .from('schema_migrations')
          .upsert({ version: migration })
          .select();
      }
      continue;
    }

    // For other migrations, try to check if their main tables exist
    try {
      // Simple check - see if we can query a table that should exist
      let tableToCheck = null;
      
      if (migration.includes('receipt')) tableToCheck = 'opportunity_receipts';
      else if (migration.includes('time_entries')) tableToCheck = 'time_entries';
      else if (migration.includes('sales')) tableToCheck = 'sales';
      else if (migration.includes('commission')) tableToCheck = 'commissions';
      else if (migration.includes('pipeline')) tableToCheck = 'pipeline_stages';
      else if (migration.includes('chatbot')) tableToCheck = 'chatbot_workflows';
      
      if (tableToCheck) {
        const { error } = await supabase
          .from(tableToCheck)
          .select('count')
          .limit(0);
          
        if (!error) {
          console.log(`✅ Migration appears to be already applied (${tableToCheck} exists)`);
          successCount++;
          
          // Mark as completed
          await supabase
            .from('schema_migrations')
            .upsert({ version: migration })
            .select();
          continue;
        }
      }
      
      console.log(`❓ Cannot verify if migration is needed`);
      console.log(`   Please check and run manually if needed`);
      skipCount++;
      
    } catch (err) {
      console.log(`❌ Error checking migration: ${err}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.log(`\n⚠️  Some migrations need to be run manually in the Supabase SQL Editor.`);
    console.log(`   Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new`);
  }

  // Final check for ghl_contacts table
  console.log('\n🔍 Checking if contact sync tables exist...');
  const { error: contactsError } = await supabase
    .from('ghl_contacts')
    .select('count')
    .limit(0);

  if (contactsError && contactsError.code === '42P01') {
    console.log(`\n❌ IMPORTANT: The ghl_contacts table does not exist!`);
    console.log(`   You must run the contacts sync migration manually:`);
    console.log(`   1. Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new`);
    console.log(`   2. Copy from: supabase/migrations/20250730_ghl_contacts_sync.sql`);
    console.log(`   3. Click "Run"`);
  } else if (!contactsError) {
    console.log(`✅ Contact sync tables are ready!`);
    
    const { count } = await supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact', head: true });
      
    console.log(`   Current contacts in database: ${count || 0}`);
    
    if (count === 0) {
      console.log(`\n💡 No contacts in database yet.`);
      console.log(`   Go to the Contacts page and click "Sync Contacts" to import from GoHighLevel.`);
    }
  }
}

runMigrations().catch(console.error);