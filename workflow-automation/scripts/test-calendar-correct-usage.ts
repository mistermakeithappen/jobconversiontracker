#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables FIRST
config({ path: join(__dirname, '../.env.local') });

// Import after env vars are loaded
import { getServiceSupabase } from '../lib/supabase/client';
import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import { decrypt } from '../lib/utils/encryption';

const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

// Get MCP configuration
async function getMCPConfig() {
  const supabase = getServiceSupabase();
  
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', MOCK_USER_ID)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .eq('mcp_enabled', true)
    .single();

  if (error || !integration) {
    throw new Error('MCP not enabled for this integration');
  }

  let mcpToken;
  if (integration.mcp_token_encrypted) {
    try {
      const tokenData = JSON.parse(integration.mcp_token_encrypted);
      if (tokenData.type === 'user_api_keys_reference' && tokenData.api_key_id) {
        const { data: apiKey } = await supabase
          .from('user_api_keys')
          .select('encrypted_key')
          .eq('id', tokenData.api_key_id)
          .eq('is_active', true)
          .single();
        
        if (apiKey) {
          mcpToken = decrypt(apiKey.encrypted_key);
        }
      }
    } catch (parseError) {
      mcpToken = decrypt(integration.mcp_token_encrypted);
    }
  }

  return {
    mcpToken,
    locationId: integration.config.locationId
  };
}

// Convert date to milliseconds
function dateToMillis(dateStr: string): string {
  return new Date(dateStr).getTime().toString();
}

// Test calendar events with correct parameters
async function testCalendarEvents() {
  console.log('🚀 Testing Calendar Events with CORRECT Parameters\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    const config = await getMCPConfig();
    const client = await createGHLMCPClient(config);

    if (!client) {
      throw new Error('Failed to create MCP client');
    }

    // Get users to find a valid userId
    console.log('📋 Getting users first...\n');
    const usersResult = await client.callTool('users_list-users', {});
    
    if (usersResult?.users?.length > 0) {
      const user = usersResult.users[0];
      console.log(`✅ Found user: ${user.name || user.firstName || 'Unknown'} (${user.id})\n`);
      
      // Test with correct parameters
      const testCases = [
        {
          name: 'Calendar events by userId',
          arguments: {
            query_userId: user.id,
            query_startTime: dateToMillis('2024-01-01'),
            query_endTime: dateToMillis('2025-12-31')
          }
        },
        {
          name: 'Calendar events with locationId',
          arguments: {
            query_locationId: config.locationId,
            query_userId: user.id,
            query_startTime: dateToMillis('2024-01-01'),
            query_endTime: dateToMillis('2025-12-31')
          }
        }
      ];

      for (const test of testCases) {
        console.log(`\n📌 Test: ${test.name}`);
        console.log('Arguments:', JSON.stringify(test.arguments, null, 2));
        
        try {
          const result = await client.callTool('calendars_get-calendar-events', test.arguments);
          
          if (result) {
            const events = Array.isArray(result) ? result : (result.events || []);
            console.log(`✅ Success! Found ${events.length} events`);
            
            if (events.length > 0) {
              console.log('\nSample event structure:');
              console.log(JSON.stringify(events[0], null, 2));
              
              // Check for contact-related fields
              const sampleEvent = events[0];
              const contactFields = ['contactId', 'contact_id', 'attendees', 'participants'];
              
              console.log('\nChecking for contact-related fields:');
              for (const field of contactFields) {
                if (sampleEvent[field] !== undefined) {
                  console.log(`  ✓ Found field "${field}":`, sampleEvent[field]);
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error:`, error);
        }
      }
    } else {
      console.log('❌ No users found in the system');
    }

    await client.disconnect();
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 CONCLUSION: The calendars_get-calendar-events tool does NOT support filtering by contactId.');
    console.log('   It only supports filtering by userId, groupId, or calendarId.\n');
    console.log('   To find events for a specific contact, you would need to:');
    console.log('   1. Get all events for a user/group/calendar');
    console.log('   2. Filter the results client-side by checking attendees or other contact fields\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the test
testCalendarEvents().catch(console.error);