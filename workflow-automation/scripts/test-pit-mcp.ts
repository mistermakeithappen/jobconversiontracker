import { createClient } from '@supabase/supabase-js';
import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testPITMCP() {
  console.log('🔍 Testing MCP with PIT token format...\n');
  
  // Use a realistic PIT token format for testing
  const testToken = 'pit_test_token_format';
  const locationId = 'VgOeEyKgYl9vAS8IcFLx'; // From the integration
  
  console.log('Testing MCP connection with:');
  console.log('  Token format:', testToken.substring(0, 8) + '...');
  console.log('  Location ID:', locationId);
  console.log('  MCP URL:', 'https://services.leadconnectorhq.com/mcp/');
  
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
    
    // Test the new request format
    console.log('\n🌐 Testing direct API call with new format...');
    
    const response = await fetch('https://services.leadconnectorhq.com/mcp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${testToken}`,
        'locationId': locationId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'contacts_get-contact',
        params: {
          contactId: 'test123'
        },
        id: Date.now()
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        console.log('📡 Received streaming response, reading...');
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            result += chunk;
            console.log('Chunk:', chunk);
            
            // Look for complete JSON data
            const lines = result.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr && jsonStr !== '[DONE]') {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    console.log('✅ Parsed JSON from stream:', parsed);
                    return; // Exit early once we get data
                  } catch (parseError) {
                    console.log('⚠️ Could not parse JSON:', jsonStr);
                  }
                }
              }
            }
          }
        }
        
        console.log('Full stream result:', result);
      } else {
        const data = await response.json();
        console.log('✅ Response received:', data);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      
      // Check if it's an authentication issue vs format issue
      if (response.status === 401) {
        console.log('🔑 This appears to be an authentication issue - you need a valid PIT token');
      } else if (response.status === 404) {
        console.log('🔍 This might be a URL or format issue');
      }
    }
    
    await client.disconnect();

  } catch (error) {
    console.log('❌ MCP connection failed:', error);
  }
}

testPITMCP().catch(console.error);