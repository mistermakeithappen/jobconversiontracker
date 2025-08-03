import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMCPColumnsMigration() {
  console.log('🔧 Adding MCP columns to integrations table...\n');
  
  // Since we can't use exec_sql, I'll provide the exact SQL to run
  console.log('💡 Please run this SQL in your Supabase Dashboard SQL Editor:');
  console.log('');
  console.log('-- Add MCP-related fields to integrations table');
  console.log('ALTER TABLE integrations');
  console.log('ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false,');
  console.log('ADD COLUMN IF NOT EXISTS mcp_token_encrypted TEXT,');
  console.log('ADD COLUMN IF NOT EXISTS mcp_endpoint TEXT,');
  console.log('ADD COLUMN IF NOT EXISTS mcp_capabilities JSONB DEFAULT \'{}\',');
  console.log('ADD COLUMN IF NOT EXISTS mcp_last_connected_at TIMESTAMP WITH TIME ZONE;');
  console.log('');
  console.log('-- Add comments');
  console.log('COMMENT ON COLUMN integrations.mcp_enabled IS \'Whether MCP is enabled for this integration\';');
  console.log('COMMENT ON COLUMN integrations.mcp_token_encrypted IS \'Encrypted MCP bearer token\';');
  console.log('COMMENT ON COLUMN integrations.mcp_endpoint IS \'MCP server endpoint URL\';');
  console.log('COMMENT ON COLUMN integrations.mcp_capabilities IS \'Cached list of MCP tools, resources, and prompts\';');
  console.log('COMMENT ON COLUMN integrations.mcp_last_connected_at IS \'Last successful MCP connection timestamp\';');
  console.log('');
  
  // Test if the user has already run the migration by checking if we can select one of the columns
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  console.log('🔍 Testing if columns exist after you run the migration...');
  
  let attempts = 0;
  const maxAttempts = 30; // Wait up to 30 seconds
  
  while (attempts < maxAttempts) {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('mcp_enabled')
        .limit(1);
        
      if (!error) {
        console.log('✅ MCP columns have been added successfully!');
        console.log('🎉 You can now use the MCP functionality.');
        break;
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      if (attempts < maxAttempts) {
        process.stdout.write('.');
      }
      
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ Still waiting for columns to be added.');
    console.log('💡 Make sure to run the SQL commands above in your Supabase Dashboard.');
  }
}

runMCPColumnsMigration().catch(console.error);