import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAllIntegrations() {
  console.log('Checking all GoHighLevel integrations...\n');
  
  // Get all integrations
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'gohighlevel')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching integrations:', error);
    return;
  }
  
  console.log(`Found ${integrations?.length || 0} GoHighLevel integrations:\n`);
  
  integrations?.forEach((integration, index) => {
    console.log(`Integration ${index + 1}:`);
    console.log('  ID:', integration.id);
    console.log('  Created:', new Date(integration.created_at).toISOString());
    console.log('  Active:', integration.is_active);
    console.log('  Organization:', integration.organization_id);
    console.log('  Location ID:', integration.config?.locationId);
    console.log('  MCP Enabled:', integration.mcp_enabled);
    console.log('  Has MCP Token:', !!integration.mcp_token_encrypted);
    console.log('  Metadata:', JSON.stringify(integration.metadata, null, 2));
    console.log('---');
  });
}

checkAllIntegrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });