import { createClient } from '@supabase/supabase-js';
import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import * as dotenv from 'dotenv';
import { decrypt } from '../lib/utils/encryption';

dotenv.config({ path: '.env.local' });

async function testCalendarParameters() {
  console.log('🗓️  Testing Calendar Event Parameters...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get integration details
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .eq('mcp_enabled', true)
    .single();

  if (!integration) {
    console.log('❌ No active GHL integration found');
    return;
  }

  // Get MCP token from user_api_keys table
  const { data: apiKey } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('provider', 'ghlmcp')
    .single();

  if (!apiKey || !apiKey.encrypted_key) {
    console.log('❌ No MCP token found in user_api_keys table');
    return;
  }

  const mcpToken = decrypt(apiKey.encrypted_key);
  const locationId = integration.config?.locationId || integration.location_id;

  console.log('📍 Using Location ID:', locationId);
  console.log('🔑 MCP Token:', mcpToken.substring(0, 10) + '...');
  console.log('🌐 MCP URL:', process.env.GHL_MCP_URL || 'https://services.leadconnectorhq.com/mcp/');
  console.log('\n');

  try {
    const client = await createGHLMCPClient({
      mcpToken,
      locationId
    });

    if (!client) {
      console.log('❌ Failed to create MCP client');
      return;
    }

    console.log('✅ MCP client created successfully\n');

    // 1. List all tools to see the schema
    console.log('📋 Step 1: Listing all MCP tools to check schemas...\n');
    const tools = await client.listTools();
    
    // Find calendar tools
    const calendarTools = tools.tools.filter((tool: any) => 
      tool.name.includes('calendar')
    );
    
    console.log('🗓️  Calendar Tools Found:');
    calendarTools.forEach((tool: any) => {
      console.log(`\n  Tool: ${tool.name}`);
      console.log(`  Description: ${tool.description}`);
    });

    // 2. Make a direct MCP call to get the full tool schema
    console.log('\n\n📊 Step 2: Getting full schema via direct MCP call...\n');
    
    const schemaRequestBody = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: Date.now()
    };

    const schemaResponse = await fetch(process.env.GHL_MCP_URL || 'https://services.leadconnectorhq.com/mcp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${mcpToken}`,
        'locationId': locationId
      },
      body: JSON.stringify(schemaRequestBody)
    });

    if (!schemaResponse.ok) {
      console.log('❌ Schema request failed:', schemaResponse.status, schemaResponse.statusText);
      const errorText = await schemaResponse.text();
      console.log('Error:', errorText);
    } else {
      // Check if response is SSE or JSON
      const contentType = schemaResponse.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        console.log('📡 Received Server-Sent Events response for schema');
        // Would need to parse SSE here, but for brevity, let's skip
      } else {
        const schemaData = await schemaResponse.json();
        console.log('📄 Full schema response received');
        
        // Look for calendar event tool specifically
        if (schemaData.result && schemaData.result.tools) {
          const calendarEventTool = schemaData.result.tools.find((tool: any) => 
            tool.name === 'calendars_get-calendar-events'
          );
          
          if (calendarEventTool) {
            console.log('\n🎯 calendars_get-calendar-events schema:');
            console.log(JSON.stringify(calendarEventTool, null, 2));
          }
        }
      }
    }

    // 3. Test different parameter formats
    console.log('\n\n🧪 Step 3: Testing different parameter formats...\n');

    const testFormats = [
      {
        name: 'Format 1: Plain parameters',
        params: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          limit: 10
        }
      },
      {
        name: 'Format 2: With query_ prefix',
        params: {
          query_startDate: new Date().toISOString(),
          query_endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          query_limit: 10
        }
      },
      {
        name: 'Format 3: With path_ prefix for IDs',
        params: {
          path_userId: 'test-user-id',
          query_startDate: new Date().toISOString(),
          query_endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        name: 'Format 4: Mixed prefixes',
        params: {
          userId: 'test-user-id',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    ];

    for (const format of testFormats) {
      console.log(`\n🔄 Testing ${format.name}:`);
      console.log('Parameters:', JSON.stringify(format.params, null, 2));
      
      try {
        const result = await client.callTool('calendars_get-calendar-events', format.params);
        console.log('✅ Success! Result:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
        
        // If we get a successful response, show the full structure
        if (result) {
          console.log('\n📦 Full response structure:');
          console.log(JSON.stringify(result, null, 2));
          break; // Stop testing other formats if one works
        }
      } catch (error) {
        console.log('❌ Failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // 4. Test using the helper method
    console.log('\n\n🔧 Step 4: Testing using client helper method...\n');
    
    try {
      const calendarEvents = await client.getCalendarEvents({
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      console.log('✅ Helper method success!');
      console.log('Result:', JSON.stringify(calendarEvents, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.log('❌ Helper method failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    await client.disconnect();

  } catch (error) {
    console.log('❌ Test failed:', error);
  }
}

// Run the test
testCalendarParameters().catch(console.error);