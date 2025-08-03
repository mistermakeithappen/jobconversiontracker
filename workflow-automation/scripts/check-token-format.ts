import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTokenFormat() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .single();

  if (integration) {
    console.log('Access token format:', {
      length: integration.access_token?.length,
      hasColons: integration.access_token?.includes(':'),
      colonCount: integration.access_token?.split(':').length - 1,
      preview: integration.access_token?.substring(0, 50) + '...'
    });

    console.log('\nRefresh token format:', {
      length: integration.refresh_token?.length,
      hasColons: integration.refresh_token?.includes(':'),
      colonCount: integration.refresh_token?.split(':').length - 1,
      preview: integration.refresh_token?.substring(0, 50) + '...'
    });
  }
}

checkTokenFormat().catch(console.error);