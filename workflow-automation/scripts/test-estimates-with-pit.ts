import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';
import { decrypt } from '../lib/utils/encryption';

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

async function testEstimatesWithPIT() {
  console.log('Testing estimates with Private Integration Token...\n');
  
  // Get the latest integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (!integration || !integration.config?.encryptedTokens) {
    console.error('No active GHL integration found');
    return;
  }
  
  console.log('MCP enabled:', integration.mcp_enabled);
  console.log('Has MCP token:', !!integration.mcp_token_encrypted);
  
  if (!integration.mcp_enabled || !integration.mcp_token_encrypted) {
    console.error('No Private Integration Token found. Please add PIT in GHL settings.');
    return;
  }
  
  const mcpToken = decrypt(integration.mcp_token_encrypted);
  console.log('MCP Token format:', mcpToken.substring(0, 8) + '...');
  
  // Create GHL client with MCP token
  const ghlClient = await createGHLClient(
    integration.config.encryptedTokens,
    undefined,
    mcpToken
  );
  
  console.log('\nTesting estimates endpoint with PIT...');
  
  try {
    const response = await ghlClient.getEstimates({
      limit: 5,
      offset: 0
    });
    
    console.log('Success! Response:', JSON.stringify(response, null, 2));
    
    if (response.estimates) {
      console.log(`\nFound ${response.estimates.length} estimates`);
      if (response.estimates.length > 0) {
        console.log('First estimate:', response.estimates[0]);
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEstimatesWithPIT()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });