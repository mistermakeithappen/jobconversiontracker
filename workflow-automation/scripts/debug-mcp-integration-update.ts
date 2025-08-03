import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debugMCPIntegrationUpdate() {
  console.log('🔍 Debugging MCP integration update issue...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  try {
    // 1. Get the current integration
    console.log('1. Getting current integration...');
    const { data: integration, error: getError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', mockUserId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (getError) {
      console.log('❌ Error getting integration:', getError.message);
      return;
    }

    console.log('✅ Integration found:', integration.id);
    console.log('Current mcp_enabled:', integration.mcp_enabled);
    console.log('Current mcp_token_encrypted:', !!integration.mcp_token_encrypted);
    console.log('Current mcp_endpoint:', integration.mcp_endpoint);
    
    // 2. Check what columns exist in integrations table
    console.log('\n2. Checking integrations table columns...');
    
    // Try a simple select to see available columns
    const { data: sampleIntegration, error: sampleError } = await supabase
      .from('integrations')
      .select('id, mcp_enabled, mcp_token_encrypted, mcp_endpoint, mcp_capabilities, mcp_last_connected_at')
      .eq('id', integration.id)
      .single();
      
    if (sampleError) {
      console.log('❌ Column check error:', sampleError.message);
      if (sampleError.message.includes('mcp_endpoint')) {
        console.log('💡 mcp_endpoint column does not exist');
      }
      if (sampleError.message.includes('mcp_capabilities')) {
        console.log('💡 mcp_capabilities column does not exist');
      }
      if (sampleError.message.includes('mcp_last_connected_at')) {
        console.log('💡 mcp_last_connected_at column does not exist');
      }
    } else {
      console.log('✅ All MCP columns exist');
    }
    
    // 3. Try the exact update that's failing
    console.log('\n3. Testing the exact update operation...');
    
    const testApiKeyId = 'test-api-key-id-12345';
    
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        mcp_enabled: true,
        mcp_token_encrypted: JSON.stringify({ api_key_id: testApiKeyId, type: 'user_api_keys_reference' }),
        mcp_endpoint: 'https://services.leadconnectorhq.com/mcp/',
        mcp_last_connected_at: new Date().toISOString()
      })
      .eq('id', integration.id);

    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
      console.log('Error details:', updateError);
      
      // Try a minimal update to isolate the issue
      console.log('\n4. Testing minimal update...');
      
      const { error: minimalError } = await supabase
        .from('integrations')
        .update({
          mcp_enabled: true
        })
        .eq('id', integration.id);
        
      if (minimalError) {
        console.log('❌ Even minimal update failed:', minimalError.message);
      } else {
        console.log('✅ Minimal update succeeded');
        
        // Try adding fields one by one
        console.log('\n5. Testing field-by-field...');
        
        // Test mcp_token_encrypted
        const { error: tokenError } = await supabase
          .from('integrations')
          .update({
            mcp_token_encrypted: JSON.stringify({ api_key_id: testApiKeyId, type: 'user_api_keys_reference' })
          })
          .eq('id', integration.id);
          
        if (tokenError) {
          console.log('❌ mcp_token_encrypted update failed:', tokenError.message);
        } else {
          console.log('✅ mcp_token_encrypted update succeeded');
        }
        
        // Test mcp_endpoint
        const { error: endpointError } = await supabase
          .from('integrations')
          .update({
            mcp_endpoint: 'https://services.leadconnectorhq.com/mcp/'
          })
          .eq('id', integration.id);
          
        if (endpointError) {
          console.log('❌ mcp_endpoint update failed:', endpointError.message);
        } else {
          console.log('✅ mcp_endpoint update succeeded');
        }
      }
    } else {
      console.log('✅ Full update succeeded');
    }
    
  } catch (error) {
    console.log('❌ Debug failed:', error);
  }
}

debugMCPIntegrationUpdate().catch(console.error);