import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

async function testFixedMessageSending() {
  console.log('🚀 Testing Fixed Message Sending...\n');
  
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
    
    // Test sending a message with the correct parameter format
    console.log('\n📨 Sending message with correct parameters...');
    
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
          arguments: {
            body_type: 'SMS',
            body_contactId: contactId,
            body_message: 'Hi Brandon! This is a test message from the fixed MCP integration. You can book your free estimate at https://example.com/book'
          }
        },
        id: Date.now()
      })
    });
    
    const contentType = response.headers.get('content-type') || '';
    console.log('Response status:', response.status);
    console.log('Content type:', contentType);
    
    if (contentType.includes('text/event-stream')) {
      // Handle SSE response
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
            console.log('\n✅ Result:', JSON.stringify(parsed, null, 2));
            
            // Check if the message was sent successfully
            if (parsed.result?.content?.[0]?.text) {
              const innerResult = JSON.parse(parsed.result.content[0].text);
              if (innerResult.content?.[0]?.text) {
                const finalResult = JSON.parse(innerResult.content[0].text);
                console.log('\n📬 Final result:', JSON.stringify(finalResult, null, 2));
              }
            }
          } catch (e) {
            console.log('Parse error:', e.message);
          }
        }
      }
    } else {
      // Regular JSON response
      const data = await response.json();
      console.log('\n✅ Result:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFixedMessageSending().catch(console.error);