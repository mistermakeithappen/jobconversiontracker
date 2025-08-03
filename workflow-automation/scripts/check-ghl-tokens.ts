import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

async function checkGHLTokens() {
  console.log('🔍 Checking GHL Integration Tokens...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  try {
    // Get GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('❌ Error fetching integration:', error);
      return;
    }
    
    console.log('📋 Integration found:');
    console.log('- ID:', integration.id);
    console.log('- Type:', integration.type);
    console.log('- Active:', integration.is_active);
    console.log('- Config:', JSON.stringify(integration.config, null, 2));
    console.log('\n🔑 Token fields:');
    console.log('- access_token:', !!integration.access_token);
    console.log('- refresh_token:', !!integration.refresh_token);
    console.log('- encrypted_access_token:', !!integration.encrypted_access_token);
    console.log('- encrypted_refresh_token:', !!integration.encrypted_refresh_token);
    console.log('- encrypted_tokens:', !!integration.encrypted_tokens);
    
    // Try to decrypt tokens
    if (integration.encrypted_tokens) {
      console.log('\n🔓 Decrypting encrypted_tokens...');
      try {
        const tokens = JSON.parse(await decrypt(integration.encrypted_tokens));
        console.log('✅ Tokens decrypted:');
        console.log('- Access Token (first 10):', tokens.accessToken?.substring(0, 10));
        console.log('- Refresh Token (first 10):', tokens.refreshToken?.substring(0, 10));
        console.log('- Expires At:', new Date(tokens.expiresAt).toISOString());
        console.log('- Location ID:', tokens.locationId);
      } catch (e) {
        console.error('❌ Failed to decrypt encrypted_tokens:', e.message);
      }
    }
    
    if (integration.config?.tokens) {
      console.log('\n🔍 Tokens in config:');
      console.log('- Access Token (first 10):', integration.config.tokens.accessToken?.substring(0, 10));
      console.log('- Location ID:', integration.config.tokens.locationId);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
checkGHLTokens().catch(console.error);