import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function clearFailedSync() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Delete failed sync logs
  const { error } = await supabase
    .from('ghl_contact_sync_logs')
    .delete()
    .eq('status', 'failed');

  if (!error) {
    console.log('✅ Cleared failed sync logs');
  } else {
    console.log('❌ Error:', error);
  }
}

clearFailedSync().catch(console.error);