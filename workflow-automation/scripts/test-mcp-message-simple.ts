import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

async function testMessageSending() {
  console.log('🚀 Testing MCP Message Sending...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  const contactId = 'NDkWYQAYGh6wbr9LJOTl'; // Brandon's contact ID
  const conversationId = '5u2QNX67vNZ9G6cwbccK'; // From the logs
  
  try {
    // Get MCP token
    const { data: apiKey } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'ghlmcp')
      .single();
    
    if (!apiKey) {
      console.error('❌ No MCP token found for user');
      return;
    }
    
    // The field is named encrypted_key in the database
    let mcpToken;
    if (apiKey.encrypted_key) {
      mcpToken = await decrypt(apiKey.encrypted_key);
    } else {
      console.error('❌ No encrypted_key found in database');
      return;
    }
    console.log('✅ Retrieved MCP token (first 10 chars):', mcpToken?.substring(0, 10) || 'N/A');
    
    // Get location ID
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    const locationId = integration?.config?.locationId;
    console.log('📍 Location ID:', locationId);
    
    // Test different parameter combinations directly
    const testCases = [
      {
        name: 'Test 1: Basic message with conversationId only',
        params: {
          conversationId,
          message: 'Test 1: Hello from MCP test script'
        }
      },
      {
        name: 'Test 2: With type = SMS',
        params: {
          conversationId,
          message: 'Test 2: Hello with SMS type',
          type: 'SMS'
        }
      },
      {
        name: 'Test 3: With contactId added',
        params: {
          conversationId,
          message: 'Test 3: Hello with contact ID',
          contactId
        }
      },
      {
        name: 'Test 4: All parameters',
        params: {
          conversationId,
          message: 'Test 4: Hello with all params',
          type: 'SMS',
          contactId
        }
      },
      {
        name: 'Test 5: Only contactId (no conversationId)',
        params: {
          contactId,
          message: 'Test 5: Hello with contact ID only',
          type: 'SMS'
        }
      },
      {
        name: 'Test 6: Different param names',
        params: {
          contact_id: contactId,
          message: 'Test 6: Using contact_id instead',
          type: 'SMS'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📋 ${testCase.name}`);
      console.log('Parameters:', JSON.stringify(testCase.params, null, 2));
      
      try {
        const response = await fetch('https://services.leadconnectorhq.com/mcp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${mcpToken}`,
            'locationId': locationId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'conversations_send-a-new-message',
              arguments: testCase.params
            },
            id: Date.now()
          })
        });
        
        if (!response.ok) {
          console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
          const errorText = await response.text();
          console.log('Error:', errorText);
          continue;
        }
        
        // Check if response is SSE
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
          console.log('📡 Received SSE response, parsing...');
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let result = '';
          
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              result += chunk;
            }
          }
          
          // Parse SSE data
          const lines = result.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              const jsonStr = line.substring(6).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                console.log('✅ Result:', JSON.stringify(parsed, null, 2));
              } catch (e) {
                // Continue
              }
            }
          }
        } else {
          // Regular JSON response
          const data = await response.json();
          console.log('✅ Result:', JSON.stringify(data, null, 2));
        }
        
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMessageSending().catch(console.error);