import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkContactTables() {
  console.log('🔍 Checking if contact sync tables exist...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Check ghl_contacts table
  const { error: contactsError } = await supabase
    .from('ghl_contacts')
    .select('count')
    .limit(0);

  if (contactsError && contactsError.code === '42P01') {
    console.log('❌ ghl_contacts table does not exist\n');
    console.log('📋 To create the tables, follow these steps:\n');
    console.log('1. Go to Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new\n');
    console.log('2. Copy the SQL from ONE of these files:');
    console.log('   - supabase/migrations/20250730_ghl_contacts_sync.sql (full migration)');
    console.log('   - scripts/all-migrations-combined.sql (includes this migration)\n');
    console.log('3. Paste it in the SQL editor and click "Run"\n');
    console.log('4. After running, come back and click "Sync Contacts" on the contacts page\n');
    return;
  }

  console.log('✅ ghl_contacts table exists!');

  // Get contact count
  const { count: contactCount } = await supabase
    .from('ghl_contacts')
    .select('*', { count: 'exact', head: true });

  console.log(`   Current contacts: ${contactCount || 0}`);

  // Check sync logs table
  const { error: logsError } = await supabase
    .from('ghl_contact_sync_logs')
    .select('count')
    .limit(0);

  if (logsError && logsError.code === '42P01') {
    console.log('\n❌ ghl_contact_sync_logs table does not exist');
  } else {
    console.log('✅ ghl_contact_sync_logs table exists!');
    
    // Get latest sync
    const { data: latestSync } = await supabase
      .from('ghl_contact_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestSync) {
      console.log(`\n📊 Latest sync:`);
      console.log(`   Type: ${latestSync.sync_type}`);
      console.log(`   Status: ${latestSync.status}`);
      console.log(`   Processed: ${latestSync.contacts_processed}`);
      console.log(`   Created: ${latestSync.contacts_created}`);
      console.log(`   Updated: ${latestSync.contacts_updated}`);
      console.log(`   Started: ${new Date(latestSync.started_at).toLocaleString()}`);
      if (latestSync.completed_at) {
        console.log(`   Completed: ${new Date(latestSync.completed_at).toLocaleString()}`);
      }
    }
  }

  if (contactCount === 0) {
    console.log('\n💡 No contacts in database yet!');
    console.log('   Go to the Contacts page and click "Sync Contacts" to import from GoHighLevel.');
  } else {
    console.log('\n✅ Everything looks good! The contact sync system is ready.');
    
    // Try searching for Brandon
    const { data: brandonSearch } = await supabase
      .from('ghl_contacts')
      .select('contact_name, first_name, last_name, phone, email')
      .or('first_name.ilike.%Brandon%,last_name.ilike.%Brandon%,contact_name.ilike.%Brandon%')
      .limit(5);

    if (brandonSearch && brandonSearch.length > 0) {
      console.log('\n🔍 Found contacts with "Brandon":');
      brandonSearch.forEach(c => {
        console.log(`   - ${c.contact_name || `${c.first_name} ${c.last_name}`} | ${c.phone} | ${c.email}`);
      });
    }
  }
}

checkContactTables().catch(console.error);