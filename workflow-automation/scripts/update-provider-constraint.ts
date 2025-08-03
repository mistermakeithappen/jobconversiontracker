import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function updateProviderConstraint() {
  console.log('🔧 Updating user_api_keys provider constraint to include ghlmcp...\n');
  
  try {
    // Test current constraint by trying to insert with ghlmcp
    console.log('1. Testing current constraint...');
    
    const testResult = await supabase
      .from('user_api_keys')
      .insert({
        user_id: 'af8ba507-b380-4da8-a1e2-23adee7497d5',
        provider: 'ghlmcp',
        encrypted_key: 'test',
        key_name: 'Test GHL MCP Key',
        is_active: false
      })
      .select('id')
      .single()
      .then(async (result) => {
        // Clean up test record if successful
        if (result.data) {
          await supabase.from('user_api_keys').delete().eq('id', result.data.id);
          return { success: true, error: null };
        }
        return result;
      })
      .catch(error => ({ success: false, error }));
    
    if (testResult.success) {
      console.log('✅ ghlmcp provider already allowed');
      return;
    }
    
    if (testResult.error?.message?.includes('violates check constraint')) {
      console.log('❌ ghlmcp provider not allowed, updating constraint...');
      
      console.log('\n💡 Please run these SQL commands in your Supabase Dashboard:');
      console.log('');
      console.log('-- Drop existing constraint');
      console.log('ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;');
      console.log('');
      console.log('-- Add updated constraint with ghlmcp');
      console.log("ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_provider_check CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghlmcp'));");
      console.log('');
      
      // Try to create a temporary workaround function
      console.log('🔧 Attempting to update constraint programmatically...');
      
      // Unfortunately, we can't modify constraints directly through the Supabase client
      // The user will need to run this in the SQL editor
      
    } else {
      console.log('❌ Unexpected error:', testResult.error?.message);
    }
    
  } catch (error) {
    console.log('❌ Update failed:', error);
  }
}

updateProviderConstraint().catch(console.error);