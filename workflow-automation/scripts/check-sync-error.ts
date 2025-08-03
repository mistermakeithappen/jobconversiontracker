import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSyncError() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Get latest failed sync
  const { data: failedSync } = await supabase
    .from('ghl_contact_sync_logs')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (failedSync) {
    console.log('❌ Latest failed sync:');
    console.log('   Error:', failedSync.error_message);
    console.log('   Time:', new Date(failedSync.started_at).toLocaleString());
  }
}

checkSyncError().catch(console.error);