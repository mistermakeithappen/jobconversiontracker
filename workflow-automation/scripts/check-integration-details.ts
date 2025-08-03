import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkIntegration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'gohighlevel')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (integration) {
    console.log('Integration details:');
    console.log('  ID:', integration.id);
    console.log('  Type:', integration.type);
    console.log('  Active:', integration.is_active);
    console.log('  Created:', new Date(integration.created_at).toLocaleString());
    console.log('  Has access token:', !!integration.access_token);
    console.log('  Has refresh token:', !!integration.refresh_token);
    console.log('  Expires at:', integration.expires_at ? new Date(integration.expires_at).toLocaleString() : 'N/A');
    console.log('  Config:', JSON.stringify(integration.config, null, 2));
    console.log('  MCP enabled:', integration.mcp_enabled);
    console.log('  Has MCP token:', !!integration.mcp_token_encrypted);
    
    // Check columns
    console.log('\nAll columns:', Object.keys(integration));
  }
}

checkIntegration().catch(console.error);