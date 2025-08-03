import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTotalContacts() {
  try {
    // Get total contacts count
    const { count, error } = await supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`\n📊 Total contacts in database: ${count}`);

    // Get count by sync status
    const { data: activeContacts, count: activeCount } = await supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('sync_status', 'active');

    console.log(`✅ Active contacts: ${activeCount}`);

    // Get latest contact added
    const { data: latestContact } = await supabase
      .from('ghl_contacts')
      .select('contact_id, contact_name, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestContact) {
      console.log(`\n🆕 Latest contact added:`);
      console.log(`   Name: ${latestContact.contact_name}`);
      console.log(`   ID: ${latestContact.contact_id}`);
      console.log(`   Added: ${new Date(latestContact.created_at).toLocaleString()}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTotalContacts();