import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GHLMCPClient, createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testCalendarWithMCP() {
  console.log('🔍 Testing calendar fetch with MCP...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get user's GHL integration
    console.log('1. Fetching GHL integration for user:', mockUserId);
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config, mcp_token_encrypted')
      .eq('user_id', mockUserId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (error) {
      console.error('Error fetching integration:', error);
      return;
    }
    
    if (!integration?.mcp_token_encrypted) {
      console.error('No MCP token found for GHL integration');
      return;
    }
    
    console.log('✅ Found integration with MCP token');
    console.log('   Location ID:', integration.config.locationId || 'NOT SET');
    
    // Create MCP client
    console.log('\n2. Creating MCP client...');
    const mcpClient = await createGHLMCPClient({
      mcpToken: integration.mcp_token_encrypted,
      locationId: integration.config.locationId
    });
    
    if (!mcpClient) {
      console.error('Failed to create MCP client');
      return;
    }
    
    console.log('✅ MCP client created');
    
    // Try to get calendar events using MCP
    console.log('\n3. Testing calendars_get-calendar-events...');
    try {
      const calendarEvents = await mcpClient.makeRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'calendars_get-calendar-events',
          arguments: {
            limit: 5
          }
        },
        id: Date.now()
      });
      
      console.log('\n📅 Calendar Events Response:', JSON.stringify(calendarEvents, null, 2));
    } catch (err) {
      console.error('Error getting calendar events:', err);
    }
    
    // Also try to get appointment notes
    console.log('\n4. Testing calendars_get-appointment-notes...');
    try {
      const appointmentNotes = await mcpClient.makeRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'calendars_get-appointment-notes',
          arguments: {}
        },
        id: Date.now() + 1
      });
      
      console.log('\n📝 Appointment Notes Response:', JSON.stringify(appointmentNotes, null, 2));
    } catch (err) {
      console.error('Error getting appointment notes:', err);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the test
testCalendarWithMCP().catch(console.error);