import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runMigrationManual() {
  console.log('🔧 Running MCP API key reference migration manually...');
  
  try {
    // 1. Add mcp_api_key_id column to integrations table
    console.log('1. Adding mcp_api_key_id column...');
    await supabase.rpc('exec', {
      sql: 'ALTER TABLE integrations ADD COLUMN IF NOT EXISTS mcp_api_key_id UUID;'
    }).catch(() => {
      // Try direct query instead
      return supabase.from('integrations').select('mcp_api_key_id').limit(1);
    });
    
    // 2. Update user_api_keys provider constraint
    console.log('2. Updating provider constraint...');
    
    // First get current integrations to see if column exists
    const { data: integrationData, error: intError } = await supabase
      .from('integrations')
      .select('id, mcp_enabled')
      .limit(1);
      
    if (intError && intError.message.includes('mcp_api_key_id')) {
      console.log('❌ Column mcp_api_key_id does not exist yet');
      console.log('💡 You need to add this column manually in Supabase Dashboard:');
      console.log('   ALTER TABLE integrations ADD COLUMN mcp_api_key_id UUID;');
      console.log('   ALTER TABLE integrations ADD CONSTRAINT integrations_mcp_api_key_id_fkey FOREIGN KEY (mcp_api_key_id) REFERENCES user_api_keys(id);');
    } else {
      console.log('✅ integrations table accessible');
    }
    
    // Test the user_api_keys constraint update
    const { data: testKey, error: testError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: 'af8ba507-b380-4da8-a1e2-23adee7497d5',
        provider: 'ghl_mcp',
        encrypted_key: 'test',
        key_name: 'Test MCP Key',
        is_active: false
      })
      .select('id')
      .single()
      .then(async (result) => {
        // Clean up test key
        if (result.data) {
          await supabase.from('user_api_keys').delete().eq('id', result.data.id);
        }
        return result;
      });
      
    if (testError) {
      if (testError.message.includes('violates check constraint')) {
        console.log('❌ Provider constraint needs updating');
        console.log('💡 You need to update the constraint manually in Supabase Dashboard:');
        console.log('   ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;');
        console.log("   ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_provider_check CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghl_mcp'));");
      } else {
        console.log('❌ Other error with user_api_keys:', testError.message);
      }
    } else {
      console.log('✅ user_api_keys table supports ghl_mcp provider');
    }
    
  } catch (error) {
    console.log('❌ Migration error:', error);
  }
}

runMigrationManual().catch(console.error);