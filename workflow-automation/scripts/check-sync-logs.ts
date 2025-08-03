import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSyncLogs() {
  try {
    // Get recent sync logs
    const { data: syncLogs, error: logsError } = await supabase
      .from('ghl_contact_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.error('Error fetching sync logs:', logsError);
      return;
    }

    console.log('\n🔍 Recent Contact Sync Logs:');
    console.log('=' .repeat(80));
    
    if (!syncLogs || syncLogs.length === 0) {
      console.log('No sync logs found');
      return;
    }

    for (const log of syncLogs) {
      console.log(`\nSync ID: ${log.id}`);
      console.log(`Status: ${log.status}`);
      console.log(`Type: ${log.sync_type}`);
      console.log(`Started: ${new Date(log.created_at).toLocaleString()}`);
      if (log.completed_at) {
        console.log(`Completed: ${new Date(log.completed_at).toLocaleString()}`);
      }
      console.log(`Contacts Processed: ${log.contacts_processed || 0}`);
      console.log(`Contacts Created: ${log.contacts_created || 0}`);
      console.log(`Contacts Updated: ${log.contacts_updated || 0}`);
      if (log.error_message) {
        console.log(`Error: ${log.error_message}`);
      }
      console.log('-'.repeat(40));
    }

    // Also check total contacts in database
    const { data: contactsCount, error: countError } = await supabase
      .from('ghl_contacts')
      .select('location_id', { count: 'exact', head: true });

    if (!countError && contactsCount) {
      console.log(`\n📊 Total contacts in database: ${contactsCount}`);
    }

    // Get count by location
    const { data: locationCounts, error: locError } = await supabase
      .from('ghl_contacts')
      .select('location_id')
      .eq('sync_status', 'active');

    if (!locError && locationCounts) {
      const countsByLocation = locationCounts.reduce((acc, item) => {
        acc[item.location_id] = (acc[item.location_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n📍 Contacts by Location:');
      for (const [locationId, count] of Object.entries(countsByLocation)) {
        console.log(`  ${locationId}: ${count} contacts`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSyncLogs();