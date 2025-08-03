import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

async function checkMCPToken() {
  console.log('🔍 Checking MCP Token Storage...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Check all API keys for this user
  const { data: apiKeys, error } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('❌ Error fetching API keys:', error);
    return;
  }
  
  console.log(`📋 Found ${apiKeys?.length || 0} API keys for user\n`);
  
  apiKeys?.forEach((key, index) => {
    console.log(`Key ${index + 1}:`);
    console.log('- ID:', key.id);
    console.log('- Provider:', key.provider);
    console.log('- Has api_key:', !!key.api_key);
    console.log('- Has encrypted_api_key:', !!key.encrypted_api_key);
    console.log('- Created:', key.created_at);
    console.log('- Updated:', key.updated_at);
    
    if (key.api_key) {
      console.log('- API Key (first 10):', key.api_key.substring(0, 10));
    }
    if (key.encrypted_api_key) {
      console.log('- Encrypted Key (first 20):', key.encrypted_api_key.substring(0, 20));
    }
    console.log('');
  });
  
  // Specifically look for ghlmcp
  const ghlmcpKey = apiKeys?.find(k => k.provider === 'ghlmcp');
  if (!ghlmcpKey) {
    console.log('⚠️ No ghlmcp provider key found!');
    console.log('\nYou need to add a GoHighLevel MCP token with provider "ghlmcp"');
  } else {
    console.log('✅ Found ghlmcp key');
  }
}

checkMCPToken().catch(console.error);