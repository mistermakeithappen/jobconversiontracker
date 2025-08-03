import { createClient } from '@supabase/supabase-js';
import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testMCPConnection() {
  console.log('🔍 Testing MCP connection...\n');
  
  // Test with a dummy token to see what happens
  const testToken = 'pit-test123';
  const locationId = 'VgOeEyKgYl9vAS8IcFLx'; // From the integration
  
  console.log('Testing MCP connection with:');
  console.log('  Token:', testToken.substring(0, 8) + '...');
  console.log('  Location ID:', locationId);
  console.log('  MCP URL:', process.env.GHL_MCP_URL || 'https://services.leadconnectorhq.com/mcp/');
  
  try {
    const client = await createGHLMCPClient({
      mcpToken: testToken,
      locationId: locationId
    });

    if (!client) {
      console.log('❌ Failed to create MCP client');
      return;
    }

    console.log('✅ MCP client created successfully');
    
    // Test basic connection
    try {
      const tools = await client.listTools();
      console.log('✅ Successfully connected to MCP server');
      console.log('📋 Available tools:', tools.tools?.length || 0);
      
      await client.disconnect();
    } catch (toolError) {
      console.log('❌ Failed to list tools:', toolError);
    }

  } catch (error) {
    console.log('❌ MCP connection failed:', error);
    
    // Let's test if the endpoint is reachable
    console.log('\n🌐 Testing MCP endpoint directly...');
    
    const mcpUrl = process.env.GHL_MCP_URL || 'https://services.leadconnectorhq.com/mcp/';
    
    try {
      const response = await fetch(`${mcpUrl}tools/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
          'X-Location-Id': locationId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: Date.now()
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
      
    } catch (fetchError) {
      console.log('❌ Fetch failed:', fetchError);
    }
  }
}

testMCPConnection().catch(console.error);