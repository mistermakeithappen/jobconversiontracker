import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkIntegrationsColumns() {
  console.log('🔍 Checking available columns in integrations table...\n');
  
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
    
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('✅ Available columns:');
    columns.forEach(col => {
      console.log(`  - ${col}`);
    });
    
    console.log('\n🔍 Checking for MCP-related columns:');
    const mcpColumns = ['mcp_enabled', 'mcp_token_encrypted', 'mcp_endpoint', 'mcp_capabilities', 'mcp_last_connected_at', 'mcp_api_key_id'];
    
    mcpColumns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });
    
  } else {
    console.log('❌ No integrations found');
  }
}

checkIntegrationsColumns().catch(console.error);