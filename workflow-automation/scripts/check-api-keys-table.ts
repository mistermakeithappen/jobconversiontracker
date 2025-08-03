import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkApiKeysTable() {
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  console.log('📋 Checking user_api_keys table structure...\n');
  
  // Get existing API keys
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', mockUserId);
    
  console.log('Current API Keys:');
  if (data && data.length > 0) {
    data.forEach(key => {
      console.log(`  ID: ${key.id}`);
      console.log(`  Name: ${key.key_name || 'Unnamed'}`);
      console.log(`  Type: ${key.key_type || 'Unknown'}`);
      console.log(`  Active: ${key.is_active}`);
      console.log(`  Encrypted Key Length: ${key.encrypted_key?.length || 0}`);
      console.log(`  Created: ${new Date(key.created_at).toLocaleString()}`);
      console.log(`  ---`);
    });
  } else {
    console.log('  No API keys found');
  }
  
  if (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Test inserting a sample PIT token
  console.log('\n🔧 Testing PIT token insertion...');
  
  const { encrypt } = await import('../lib/utils/encryption');
  const testPitToken = 'pit_test_example_token_12345';
  const encryptedToken = encrypt(testPitToken);
  
  const { data: insertData, error: insertError } = await supabase
    .from('user_api_keys')
    .insert({
      user_id: mockUserId,
      key_name: 'GoHighLevel MCP Token',
      key_type: 'ghl_mcp',
      encrypted_key: encryptedToken,
      is_active: true
    })
    .select()
    .single();
    
  if (insertError) {
    console.log('❌ Insert failed:', insertError.message);
  } else {
    console.log('✅ Successfully inserted test PIT token');
    console.log('Token ID:', insertData.id);
    
    // Test decryption
    const { decrypt } = await import('../lib/utils/encryption');
    const decryptedToken = decrypt(insertData.encrypted_key);
    console.log('✅ Decryption test passed:', decryptedToken === testPitToken);
    
    // Clean up the test token
    await supabase
      .from('user_api_keys')
      .delete()
      .eq('id', insertData.id);
    console.log('🧹 Test token cleaned up');
  }
}

checkApiKeysTable().catch(console.error);