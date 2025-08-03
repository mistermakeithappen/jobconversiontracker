import { getServiceSupabase } from '../lib/supabase/client';

async function checkUserApiKeysTable() {
  const supabase = getServiceSupabase();
  
  try {
    console.log('Checking user_api_keys table structure...');
    
    // Check if table exists and get a sample record to see structure
    const { data: sample, error: sampleError } = await supabase
      .from('user_api_keys')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Table query error:', sampleError);
      return;
    }
    
    console.log('✅ user_api_keys table exists!');
    console.log('Sample record structure:', sample?.[0] || 'No records found');
    
    // Try to insert a test record to see what happens
    console.log('\nTesting insert operation...');
    const testUserId = 'test-user-id';
    
    const { data: insertData, error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: testUserId,
        provider: 'ghlmcp',
        encrypted_key: 'test-encrypted-key',
        key_name: 'Test GoHighLevel MCP Token',
        is_active: true
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
    } else {
      console.log('✅ Insert test successful:', insertData);
      
      // Clean up test record
      await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', insertData.id);
      console.log('✅ Cleaned up test record');
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

checkUserApiKeysTable();