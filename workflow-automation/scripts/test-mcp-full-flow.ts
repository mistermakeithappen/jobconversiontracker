import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testMCPFullFlow() {
  console.log('🧪 Testing complete MCP token storage flow...\n');
  
  const testPitToken = 'pit_test_example_for_full_flow_12345';
  
  try {
    // 1. Test POST /api/mcp/ghl (Enable MCP)
    console.log('1. Testing MCP enablement via POST /api/mcp/ghl...');
    
    const enableResponse = await fetch('http://localhost:3000/api/mcp/ghl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpToken: testPitToken })
    });
    
    const enableData = await enableResponse.json();
    console.log('Response status:', enableResponse.status);
    console.log('Response data:', enableData);
    
    if (enableResponse.ok) {
      console.log('✅ MCP enabled successfully');
      
      // 2. Test GET /api/mcp/ghl (Check MCP status)
      console.log('\n2. Testing MCP status check via GET /api/mcp/ghl...');
      
      const statusResponse = await fetch('http://localhost:3000/api/mcp/ghl');
      const statusData = await statusResponse.json();
      
      console.log('Status response:', statusData);
      
      if (statusData.mcpEnabled) {
        console.log('✅ MCP status check passed');
        
        // 3. Verify token is stored in user_api_keys
        console.log('\n3. Verifying token storage in database...');
        
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        
        const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
        
        const { data: apiKeys } = await supabase
          .from('user_api_keys')
          .select('*')
          .eq('user_id', mockUserId)
          .eq('key_name', 'GoHighLevel MCP Token')
          .eq('is_active', true);
          
        if (apiKeys && apiKeys.length > 0) {
          console.log('✅ Token found in user_api_keys table');
          console.log('  Key ID:', apiKeys[0].id);
          console.log('  Provider:', apiKeys[0].provider);
          console.log('  Key Name:', apiKeys[0].key_name);
          
          // Test decryption
          const { decrypt } = await import('../lib/utils/encryption');
          const decryptedToken = decrypt(apiKeys[0].encrypted_key);
          
          if (decryptedToken === testPitToken) {
            console.log('✅ Token decryption successful and matches');
          } else {
            console.log('❌ Token decryption mismatch');
          }
        } else {
          console.log('❌ Token not found in user_api_keys table');
        }
        
        // 4. Test DELETE /api/mcp/ghl (Disable MCP)
        console.log('\n4. Testing MCP disable via DELETE /api/mcp/ghl...');
        
        const disableResponse = await fetch('http://localhost:3000/api/mcp/ghl', {
          method: 'DELETE'
        });
        
        const disableData = await disableResponse.json();
        console.log('Disable response:', disableData);
        
        if (disableResponse.ok) {
          console.log('✅ MCP disabled successfully');
          
          // Verify API key is deactivated
          const { data: deactivatedKeys } = await supabase
            .from('user_api_keys')
            .select('is_active')
            .eq('user_id', mockUserId)
            .eq('key_name', 'GoHighLevel MCP Token');
            
          if (deactivatedKeys && deactivatedKeys.length > 0) {
            const isActive = deactivatedKeys[0].is_active;
            if (!isActive) {
              console.log('✅ API key properly deactivated');
            } else {
              console.log('❌ API key still active');
            }
          }
        } else {
          console.log('❌ MCP disable failed:', disableData);
        }
        
      } else {
        console.log('❌ MCP status check failed');
      }
    } else {
      console.log('❌ MCP enable failed:', enableData);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error);
  }
}

// Check if dev server is running first
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:3000/api/mcp/ghl');
    return response.status !== undefined;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkDevServer();
  
  if (!serverRunning) {
    console.log('❌ Development server not running at http://localhost:3000');
    console.log('💡 Please run: npm run dev');
    return;
  }
  
  await testMCPFullFlow();
}

main().catch(console.error);