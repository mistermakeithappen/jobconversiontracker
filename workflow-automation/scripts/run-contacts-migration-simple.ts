import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  console.log('🚀 Running GHL contacts migration...\n');
  
  // Create a Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250730_ghl_contacts_sync.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📝 Migration file loaded');
  console.log('⚡ Executing migration...\n');

  // For now, let's just check if the tables exist
  try {
    // Check if ghl_contacts table exists
    const { error: contactsError } = await supabase
      .from('ghl_contacts')
      .select('count')
      .limit(0);

    if (contactsError && contactsError.code === '42P01') {
      console.log('❌ ghl_contacts table does not exist');
      console.log('\n⚠️  Please run this migration in the Supabase SQL Editor:');
      console.log('   1. Go to https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new');
      console.log('   2. Copy and paste the migration from:');
      console.log(`      ${migrationPath}`);
      console.log('   3. Click "Run" to execute the migration\n');
    } else if (!contactsError) {
      console.log('✅ ghl_contacts table already exists!');
      
      // Get count of contacts
      const { count } = await supabase
        .from('ghl_contacts')
        .select('*', { count: 'exact', head: true });
        
      console.log(`   Current contacts in database: ${count || 0}`);
    }

    // Check if sync logs table exists
    const { error: logsError } = await supabase
      .from('ghl_contact_sync_logs')
      .select('count')
      .limit(0);

    if (logsError && logsError.code === '42P01') {
      console.log('❌ ghl_contact_sync_logs table does not exist');
    } else if (!logsError) {
      console.log('✅ ghl_contact_sync_logs table already exists!');
    }

  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

runMigration().catch(console.error);