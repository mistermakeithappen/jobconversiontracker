import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

async function testCreateConversation() {
  console.log('🚀 Testing Conversation Creation and Message Sending...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  const contactId = 'NDkWYQAYGh6wbr9LJOTl'; // Brandon's contact ID
  
  try {
    // Get MCP token
    const { data: apiKey } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'ghlmcp')
      .single();
    
    if (!apiKey || !apiKey.encrypted_key) {
      console.error('❌ No MCP token found');
      return;
    }
    
    const mcpToken = await decrypt(apiKey.encrypted_key);
    console.log('✅ Retrieved MCP token:', mcpToken.substring(0, 10));
    
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
    
    // Step 1: Try to create a conversation
    console.log('\n📋 Step 1: Attempting to create a conversation...');
    
    // There might be a conversations_create tool or we need to use a different approach
    const createConvResponse = await fetch('https://services.leadconnectorhq.com/mcp/', {
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
          name: 'conversations_create-conversation',
          arguments: {
            contactId: contactId,
            type: 'SMS'
          }
        },
        id: Date.now()
      })
    });
    
    console.log('Create conversation response status:', createConvResponse.status);
    const createResult = await parseResponse(createConvResponse);
    console.log('Create result:', JSON.stringify(createResult, null, 2));
    
    // Step 2: List available tools to see what's actually available
    console.log('\n📋 Step 2: Listing available tools...');
    
    const listToolsResponse = await fetch('https://services.leadconnectorhq.com/mcp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${mcpToken}`,
        'locationId': locationId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now()
      })
    });
    
    const toolsResult = await parseResponse(listToolsResponse);
    console.log('Available tools:', JSON.stringify(toolsResult, null, 2));
    
    // Step 3: Try different message sending approaches
    console.log('\n📋 Step 3: Testing different message sending approaches...');
    
    // Test with just contactId in the main arguments
    const test1 = await testMessageApproach(mcpToken, locationId, {
      name: 'Test 1: contactId in main args',
      params: {
        contactId: contactId,
        message: 'Test message 1',
        type: 'SMS'
      }
    });
    
    // Test with nested structure
    const test2 = await testMessageApproach(mcpToken, locationId, {
      name: 'Test 2: nested structure',
      params: {
        conversation: {
          contactId: contactId
        },
        message: 'Test message 2',
        type: 'SMS'
      }
    });
    
    // Test with body instead of message
    const test3 = await testMessageApproach(mcpToken, locationId, {
      name: 'Test 3: body instead of message',
      params: {
        contactId: contactId,
        body: 'Test message 3',
        type: 'SMS'
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testMessageApproach(mcpToken: string, locationId: string, test: any) {
  console.log(`\n🔸 ${test.name}`);
  console.log('Parameters:', JSON.stringify(test.params, null, 2));
  
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
          arguments: test.params
        },
        id: Date.now()
      })
    });
    
    const result = await parseResponse(response);
    console.log('Result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.log('Error:', error.message);
    return null;
  }
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('text/event-stream')) {
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
          return JSON.parse(jsonStr);
        } catch (e) {
          // Continue
        }
      }
    }
    
    return { raw: result };
  } else {
    return await response.json();
  }
}

// Run the test
testCreateConversation().catch(console.error);