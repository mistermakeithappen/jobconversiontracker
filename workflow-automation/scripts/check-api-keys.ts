import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function checkApiKeys() {
  // Check if mock user has API keys
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', mockUserId);

  console.log('Mock user API keys:', data);
  console.log('Error:', error);

  if (!data || data.length === 0) {
    console.log('\nNo API keys found for mock user. Adding a test OpenAI key...');
    
    // Add a test API key
    const { data: newKey, error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: mockUserId,
        service: 'openai',
        encrypted_key: 'test-key-encrypted', // This would normally be encrypted
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding API key:', insertError);
    } else {
      console.log('Added test API key:', newKey);
    }
  }
}

checkApiKeys();