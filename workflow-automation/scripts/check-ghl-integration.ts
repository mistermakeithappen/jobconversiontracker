import { getServiceSupabase } from '../lib/supabase/client';
import { mockAuthServer } from '../lib/auth/mock-auth-server';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkGHLIntegration() {
  try {
    console.log('🔍 Checking GoHighLevel integration...');
    
    const { userId } = await mockAuthServer();
    console.log('✅ Mock user ID:', userId);
    
    const supabase = getServiceSupabase();
    
    // Check if user has any integrations
    const { data: allIntegrations, error: allError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId);
    
    if (allError) {
      console.error('❌ Error querying integrations:', allError);
      return;
    }
    
    console.log('📋 All integrations for user:', allIntegrations?.length || 0);
    allIntegrations?.forEach(integration => {
      console.log(`  - ${integration.type}: ${integration.name} (${integration.is_active ? 'active' : 'inactive'})`);
    });
    
    // Check specifically for GHL integration
    const { data: ghlIntegration, error: ghlError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    if (ghlError) {
      if (ghlError.code === 'PGRST116') {
        console.log('❌ No GoHighLevel integration found');
        console.log('💡 You need to connect GoHighLevel first before setting up MCP');
        console.log('   Visit /ghl to connect your GoHighLevel account');
      } else {
        console.error('❌ Error querying GHL integration:', ghlError);
      }
      return;
    }
    
    if (ghlIntegration) {
      console.log('✅ Found GoHighLevel integration:');
      console.log('  ID:', ghlIntegration.id);
      console.log('  Name:', ghlIntegration.name);
      console.log('  Config:', ghlIntegration.config);
      console.log('  MCP Enabled:', ghlIntegration.mcp_enabled || false);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkGHLIntegration();