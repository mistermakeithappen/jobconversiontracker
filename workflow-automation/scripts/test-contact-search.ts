import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testContactSearch() {
  try {
    // First, check total contacts
    const { count } = await supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('sync_status', 'active');

    console.log(`\n📊 Total active contacts: ${count}`);

    // Get sample contacts
    const { data: sampleContacts } = await supabase
      .from('ghl_contacts')
      .select('contact_id, contact_name, first_name, last_name, phone, email')
      .eq('sync_status', 'active')
      .limit(10);

    console.log('\n📋 Sample contacts:');
    sampleContacts?.forEach(c => {
      console.log(`  - ${c.contact_name} (${c.contact_id})`);
      console.log(`    Phone: ${c.phone || 'N/A'}, Email: ${c.email || 'N/A'}`);
    });

    // Test search for Brandon
    console.log('\n🔍 Searching for "Brandon"...');
    const { data: brandonSearch } = await supabase
      .from('ghl_contacts')
      .select('*')
      .eq('sync_status', 'active')
      .or('first_name.ilike.%brandon%,last_name.ilike.%brandon%,contact_name.ilike.%brandon%');

    console.log(`Found ${brandonSearch?.length || 0} contacts matching "Brandon"`);
    brandonSearch?.forEach(c => {
      console.log(`  - ${c.contact_name} (${c.contact_id})`);
      console.log(`    First: ${c.first_name}, Last: ${c.last_name}`);
      console.log(`    Phone: ${c.phone || 'N/A'}, Email: ${c.email || 'N/A'}`);
    });

    // Test exact search
    console.log('\n🔍 Searching for exact "Brandon Burgan"...');
    const { data: exactSearch } = await supabase
      .from('ghl_contacts')
      .select('*')
      .eq('sync_status', 'active')
      .or('contact_name.ilike.%brandon burgan%,contact_name.ilike.%burgan brandon%');

    console.log(`Found ${exactSearch?.length || 0} contacts matching "Brandon Burgan"`);
    exactSearch?.forEach(c => {
      console.log(`  - ${c.contact_name} (${c.contact_id})`);
      console.log(`    Phone: ${c.phone || 'N/A'}, Email: ${c.email || 'N/A'}`);
    });

    // Check location IDs
    const { data: locations } = await supabase
      .from('ghl_contacts')
      .select('location_id')
      .eq('sync_status', 'active')
      .limit(1);

    if (locations && locations.length > 0) {
      console.log(`\n📍 Using location ID: ${locations[0].location_id}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testContactSearch();