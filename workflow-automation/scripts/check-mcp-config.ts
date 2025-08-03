import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkMCPConfig() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  console.log('🔍 Checking MCP configuration...\n');
  
  // Get GHL integration
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel')
    .eq('is_active', true);
    
  if (error) {
    console.log('❌ Error fetching integration:', error.message);
    return;
  }
  
  if (!integration || integration.length === 0) {
    console.log('❌ No active GHL integration found');
    return;
  }
  
  const ghl = integration[0];
  console.log('📋 GHL Integration Found:');
  console.log('  ID:', ghl.id);
  console.log('  Connected:', ghl.is_active);
  console.log('  MCP Enabled:', ghl.mcp_enabled || false);
  console.log('  MCP Token Encrypted:', !!ghl.mcp_token_encrypted);
  console.log('  MCP Endpoint:', ghl.mcp_endpoint || 'Not set');
  console.log('  Last Connected:', ghl.mcp_last_connected_at || 'Never');
  
  if (ghl.config) {
    console.log('  Location ID:', ghl.config.locationId || 'Not found');
  }
  
  // Check user API keys table
  const { data: apiKeys } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', mockUserId);
    
  console.log('\n🔑 User API Keys:');
  if (apiKeys && apiKeys.length > 0) {
    apiKeys.forEach(key => {
      console.log(`  ${key.key_name}: ${key.is_active ? 'Active' : 'Inactive'} (Created: ${new Date(key.created_at).toLocaleDateString()})`);
    });
  } else {
    console.log('  No API keys found');
  }
  
  // Test encryption/decryption if we have a token
  if (ghl.mcp_token_encrypted) {
    try {
      const { decrypt } = await import('../lib/utils/encryption');
      const decryptedToken = decrypt(ghl.mcp_token_encrypted);
      console.log('\n🔐 Token decryption test:');
      console.log('  Encrypted length:', ghl.mcp_token_encrypted.length);
      console.log('  Decrypted starts with:', decryptedToken.substring(0, 10) + '...');
      console.log('  ✅ Token decryption successful');
    } catch (decryptError) {
      console.log('\n❌ Token decryption failed:', decryptError);
    }
  }
}

checkMCPConfig().catch(console.error);