import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import { ApiKeyManager } from '../lib/utils/api-key-manager';
import { getServiceSupabase } from '../lib/supabase/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSendMessage() {
  console.log('🚀 Testing MCP Send Message functionality...\n');
  
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5'; // Mock user ID
  const contactId = 'NDkWYQAYGh6wbr9LJOTl'; // Brandon's contact ID
  const conversationId = '5u2QNX67vNZ9G6cwbccK'; // From the logs
  
  try {
    // Get MCP token
    const mcpToken = await ApiKeyManager.getApiKey(userId, 'ghlmcp');
    console.log('✅ Retrieved MCP token (first 10 chars):', mcpToken?.substring(0, 10));
    
    // Get location ID from integration
    const supabase = getServiceSupabase();
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    const locationId = integration?.config?.locationId;
    console.log('📍 Location ID:', locationId);
    
    // Create MCP client
    const client = await createGHLMCPClient({
      mcpToken,
      locationId
    });
    
    console.log('\n🔍 Testing different parameter combinations:\n');
    
    // Test 1: Just conversationId and message
    console.log('Test 1: conversationId + message only');
    try {
      const result1 = await client.callTool('conversations_send-a-new-message', {
        conversationId,
        message: 'Test 1: Basic message'
      });
      console.log('✅ Result:', JSON.stringify(result1, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 2: conversationId + message + type
    console.log('\nTest 2: conversationId + message + type');
    try {
      const result2 = await client.callTool('conversations_send-a-new-message', {
        conversationId,
        message: 'Test 2: Message with type',
        type: 'SMS'
      });
      console.log('✅ Result:', JSON.stringify(result2, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 3: conversationId + message + contactId
    console.log('\nTest 3: conversationId + message + contactId');
    try {
      const result3 = await client.callTool('conversations_send-a-new-message', {
        conversationId,
        message: 'Test 3: Message with contact ID',
        contactId
      });
      console.log('✅ Result:', JSON.stringify(result3, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 4: All parameters
    console.log('\nTest 4: All parameters (conversationId + message + type + contactId)');
    try {
      const result4 = await client.callTool('conversations_send-a-new-message', {
        conversationId,
        message: 'Test 4: Message with all parameters',
        type: 'SMS',
        contactId
      });
      console.log('✅ Result:', JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 5: Just contactId without conversationId
    console.log('\nTest 5: contactId + message (no conversationId)');
    try {
      const result5 = await client.callTool('conversations_send-a-new-message', {
        contactId,
        message: 'Test 5: Message with contact ID only',
        type: 'SMS'
      });
      console.log('✅ Result:', JSON.stringify(result5, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    // Test 6: Different parameter names
    console.log('\nTest 6: Alternative parameter names');
    try {
      const result6 = await client.callTool('conversations_send-a-new-message', {
        conversation_id: conversationId,
        body: 'Test 6: Alternative parameter names',
        messageType: 'SMS',
        contact_id: contactId
      });
      console.log('✅ Result:', JSON.stringify(result6, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
    
    await client.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSendMessage().catch(console.error);