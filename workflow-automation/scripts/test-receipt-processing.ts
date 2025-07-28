import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../lib/utils/encryption';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testReceiptProcessing() {
  try {
    // 1. Get the stored API key
    const { data: apiKeyData, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', mockUserId)
      .eq('provider', 'openai')
      .eq('is_active', true)
      .single();

    if (error || !apiKeyData) {
      console.error('No OpenAI API key found for mock user');
      return;
    }

    // 2. Decrypt the API key
    console.log('Decrypting API key...');
    let decryptedKey;
    try {
      decryptedKey = decrypt(apiKeyData.encrypted_key);
      console.log('API key decrypted successfully');
      console.log('API key format:', decryptedKey.startsWith('sk-') ? 'Valid OpenAI format' : 'Invalid format');
    } catch (decryptError) {
      console.error('Failed to decrypt API key:', decryptError);
      return;
    }

    // 3. Test OpenAI connection
    console.log('\nTesting OpenAI connection...');
    const openai = new OpenAI({
      apiKey: decryptedKey
    });

    try {
      const models = await openai.models.list();
      console.log('✅ OpenAI connection successful!');
      console.log('Available models:', models.data.slice(0, 3).map(m => m.id).join(', '), '...');
    } catch (openaiError: any) {
      console.error('❌ OpenAI connection failed:', openaiError.message);
      if (openaiError.status === 401) {
        console.error('The API key is invalid or expired. Please update it in the settings.');
      }
    }

    // 4. Check opportunity cache for job matching
    console.log('\nChecking opportunity cache...');
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('*')
      .eq('user_id', mockUserId)
      .limit(5);

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
    } else {
      console.log(`Found ${opportunities?.length || 0} opportunities in cache`);
      if (opportunities && opportunities.length > 0) {
        console.log('Sample opportunity:', {
          name: opportunities[0].name,
          contact: opportunities[0].contact_name,
          status: opportunities[0].status
        });
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testReceiptProcessing();