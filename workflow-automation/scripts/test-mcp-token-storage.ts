import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function testMCPTokenStorage() {
  console.log('🧪 Testing MCP token storage in user_api_keys...');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  const testPitToken = 'pit_test_12345_example_token';
  
  try {
    const { encrypt, decrypt } = await import('../lib/utils/encryption');
    const encryptedToken = encrypt(testPitToken);
    
    console.log('✅ Token encrypted successfully');
    
    // Try to insert the token with different providers to test constraint
    console.log('\n🔍 Testing provider constraint...');
    
    // Test with existing provider
    const { data: testKey1, error: error1 } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: mockUserId,
        provider: 'openai', // This should work
        encrypted_key: encryptedToken,
        key_name: 'Test OpenAI Key',
        is_active: false
      })
      .select('id')
      .single();
      
    if (error1) {
      console.log('❌ Failed to insert with openai provider:', error1.message);
    } else {
      console.log('✅ Successfully inserted with openai provider');
      // Clean up
      await supabase.from('user_api_keys').delete().eq('id', testKey1.id);
    }
    
    // Test with ghl_mcp provider
    const { data: testKey2, error: error2 } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: mockUserId,
        provider: 'ghl_mcp', // This might fail if constraint not updated
        encrypted_key: encryptedToken,
        key_name: 'Test GHL MCP Key',
        is_active: false
      })
      .select('id')
      .single();
      
    if (error2) {
      console.log('❌ Failed to insert with ghl_mcp provider:', error2.message);
      console.log('💡 This means the provider constraint needs to be updated');
      
      // For now, let's try using 'notion' as a workaround
      console.log('\n🔧 Testing with notion provider as workaround...');
      
      const { data: testKey3, error: error3 } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: mockUserId,
          provider: 'notion', // Use existing allowed provider
          encrypted_key: encryptedToken,
          key_name: 'GHL MCP Token (stored as notion)',
          is_active: false
        })
        .select('id')
        .single();
        
      if (error3) {
        console.log('❌ Even notion provider failed:', error3.message);
      } else {
        console.log('✅ Successfully inserted with notion provider as workaround');
        
        // Test decryption
        const { data: retrievedKey } = await supabase
          .from('user_api_keys')
          .select('encrypted_key')
          .eq('id', testKey3.id)
          .single();
          
        if (retrievedKey) {
          const decryptedToken = decrypt(retrievedKey.encrypted_key);
          console.log('✅ Token retrieved and decrypted successfully');
          console.log('✅ Tokens match:', decryptedToken === testPitToken);
        }
        
        // Clean up
        await supabase.from('user_api_keys').delete().eq('id', testKey3.id);
        console.log('🧹 Test data cleaned up');
      }
    } else {
      console.log('✅ Successfully inserted with ghl_mcp provider');
      // Clean up
      await supabase.from('user_api_keys').delete().eq('id', testKey2.id);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error);
  }
}

testMCPTokenStorage().catch(console.error);