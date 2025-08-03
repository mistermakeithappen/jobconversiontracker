import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugIntegration() {
  try {
    // Get GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      console.error('No active GoHighLevel integration found');
      return;
    }

    console.log('\n🔍 Integration Details:');
    console.log('ID:', integration.id);
    console.log('Type:', integration.type);
    console.log('Created:', new Date(integration.created_at).toLocaleString());
    console.log('Expires:', integration.expires_at ? new Date(integration.expires_at).toLocaleString() : 'No expiry');
    console.log('Config:', {
      locationId: integration.config?.locationId,
      companyId: integration.config?.companyId,
      userId: integration.config?.userId,
      hasEncryptedTokens: !!integration.config?.encryptedTokens
    });
    console.log('MCP Enabled:', integration.mcp_enabled);
    console.log('Access Token:', integration.access_token ? 'Present (encrypted)' : 'Missing');
    console.log('Refresh Token:', integration.refresh_token ? 'Present (encrypted)' : 'Missing');

    // Try to decrypt tokens from different sources
    console.log('\n🔐 Token Status:');
    
    // Check config.encryptedTokens
    if (integration.config?.encryptedTokens) {
      try {
        const decrypted = decrypt(integration.config.encryptedTokens);
        const tokens = JSON.parse(decrypted);
        console.log('✅ config.encryptedTokens: Valid');
        console.log('   Token structure:', Object.keys(tokens));
        console.log('   Has access_token:', !!tokens.access_token);
        console.log('   Has accessToken:', !!tokens.accessToken);
      } catch (e) {
        console.log('❌ config.encryptedTokens: Failed to decrypt -', e.message);
      }
    } else {
      console.log('❌ config.encryptedTokens: Not present');
    }

    // Check direct access_token field
    if (integration.access_token) {
      try {
        const decrypted = decrypt(integration.access_token);
        console.log('✅ access_token field: Valid, length:', decrypted.length);
      } catch (e) {
        console.log('❌ access_token field: Failed to decrypt -', e.message);
      }
    } else {
      console.log('❌ access_token field: Not present');
    }

    // Check direct refresh_token field
    if (integration.refresh_token) {
      try {
        const decrypted = decrypt(integration.refresh_token);
        console.log('✅ refresh_token field: Valid, length:', decrypted.length);
      } catch (e) {
        console.log('❌ refresh_token field: Failed to decrypt -', e.message);
      }
    } else {
      console.log('❌ refresh_token field: Not present');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugIntegration();