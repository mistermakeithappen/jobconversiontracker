#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables FIRST
config({ path: join(__dirname, '../.env.local') });

// Now import modules that depend on environment variables
import { getServiceSupabase } from '../lib/supabase/client';
import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import { decrypt } from '../lib/utils/encryption';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

// Get MCP client configuration
async function getMCPConfig() {
  const supabase = getServiceSupabase();
  
  // Get user's GHL integration
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

  // Get MCP token
  let mcpToken;
  if (integration.mcp_token_encrypted) {
    try {
      const tokenData = JSON.parse(integration.mcp_token_encrypted);
      
      if (tokenData.type === 'user_api_keys_reference' && tokenData.api_key_id) {
        // Get token from user_api_keys table
        const { data: apiKey, error: keyError } = await supabase
          .from('user_api_keys')
          .select('encrypted_key')
          .eq('id', tokenData.api_key_id)
          .eq('is_active', true)
          .single();
          
        if (keyError || !apiKey) {
          throw new Error('MCP API key not found or inactive');
        }
        
        mcpToken = decrypt(apiKey.encrypted_key);
      }
    } catch (parseError) {
      // Old format, direct encrypted token
      mcpToken = decrypt(integration.mcp_token_encrypted);
    }
  }

  return {
    mcpToken,
    locationId: integration.config.locationId
  };
}

// Get the exact schema for calendars_get-calendar-events
async function listTools() {
  console.log('📋 Listing MCP tools to get exact schema...\n');
  
  try {
    const config = await getMCPConfig();
    const client = await createGHLMCPClient(config);

    if (!client) {
      throw new Error('Failed to create MCP client');
    }

    const { tools } = await client.listTools();
    
    // Find the calendar events tool
    const calendarTool = tools?.find((tool: any) => 
      tool.name === 'calendars_get-calendar-events'
    );
    
    if (calendarTool) {
      console.log('✅ Found calendars_get-calendar-events tool:\n');
      console.log(JSON.stringify(calendarTool, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    } else {
      console.log('❌ Could not find calendars_get-calendar-events tool');
    }

    await client.disconnect();
    
    return calendarTool;
  } catch (error) {
    console.error('Error listing tools:', error);
    return null;
  }
}

// Test calendar events with different contactId parameter formats
async function testCalendarWithContactId(contactId: string) {
  console.log(`🔍 Testing calendar events with contactId: ${contactId}\n`);
  
  const testConfigs = [
    {
      name: 'Direct contactId parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        contactId: contactId
      }
    },
    {
      name: 'query_contactId parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        query_contactId: contactId
      }
    },
    {
      name: 'path_contactId parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        path_contactId: contactId
      }
    },
    {
      name: 'body_contactId parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        body_contactId: contactId
      }
    },
    {
      name: 'contactId in query object',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        query: {
          contactId: contactId
        }
      }
    },
    {
      name: 'contactId with includeRemoved',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        contactId: contactId,
        includeRemoved: false
      }
    },
    {
      name: 'All variations combined',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        contactId: contactId,
        query_contactId: contactId,
        path_contactId: contactId,
        body_contactId: contactId,
        includeRemoved: false
      }
    }
  ];
  
  try {
    const config = await getMCPConfig();
    const client = await createGHLMCPClient(config);

    if (!client) {
      throw new Error('Failed to create MCP client');
    }

    for (const testConfig of testConfigs) {
      console.log(`\n📌 Test: ${testConfig.name}`);
      console.log('Arguments:', JSON.stringify(testConfig.arguments, null, 2));
      
      try {
        const result = await client.callTool('calendars_get-calendar-events', testConfig.arguments);
        
        if (result.error) {
          console.log(`❌ Tool error: ${result.error}`);
        } else if (result) {
          const events = Array.isArray(result) ? result : [result];
          console.log(`✅ Success! Found ${events.length} events`);
          
          // Check if any events have contactId
          const eventsWithContact = events.filter((event: any) => 
            event.contactId || event.contact_id || event.attendees?.some((a: any) => a.contactId === contactId)
          );
          
          if (eventsWithContact.length > 0) {
            console.log(`🎯 ${eventsWithContact.length} events have contact association!`);
            console.log('Sample event with contact:', JSON.stringify(eventsWithContact[0], null, 2));
          } else {
            console.log('📊 No events found with this contact');
          }
        }
      } catch (error) {
        console.error(`❌ Request failed:`, error);
      }
    }

    await client.disconnect();
  } catch (error) {
    console.error('Error creating MCP client:', error);
  }
}

// Get a contact ID to test with
async function getTestContactId(): Promise<string | null> {
  console.log('🔍 Getting a test contact ID...\n');
  
  try {
    const config = await getMCPConfig();
    const client = await createGHLMCPClient(config);

    if (!client) {
      throw new Error('Failed to create MCP client');
    }

    const result = await client.callTool('contacts_get-contacts', { limit: 1 });
    
    await client.disconnect();
    
    if (result?.contacts?.length > 0) {
      const contact = result.contacts[0];
      console.log(`✅ Found test contact: ${contact.name || contact.firstName || 'Unknown'} (${contact.id})\n`);
      return contact.id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting test contact:', error);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Testing Calendar Events with Contact ID Filtering\n');
  console.log('='.repeat(80) + '\n');
  
  // Step 1: Get the exact tool schema
  const toolSchema = await listTools();
  
  // Step 2: Get a test contact ID
  const contactId = await getTestContactId();
  
  if (!contactId) {
    console.log('❌ Could not find a test contact. Please ensure you have contacts in your GHL account.');
    return;
  }
  
  // Step 3: Test various parameter formats
  await testCalendarWithContactId(contactId);
  
  // Step 4: Try alternative approaches
  console.log('\n' + '='.repeat(80));
  console.log('\n🔍 Testing alternative filtering approaches...\n');
  
  // Test with search/filter parameters
  const alternativeTests = [
    {
      name: 'Using search parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        search: contactId
      }
    },
    {
      name: 'Using filter parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        filter: { contactId }
      }
    },
    {
      name: 'Using where parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        where: { contactId }
      }
    },
    {
      name: 'Using attendeeId parameter',
      arguments: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        attendeeId: contactId
      }
    }
  ];
  
  try {
    const config = await getMCPConfig();
    const client = await createGHLMCPClient(config);

    if (!client) {
      throw new Error('Failed to create MCP client');
    }

    for (const test of alternativeTests) {
      console.log(`\n📌 Alternative test: ${test.name}`);
      console.log('Arguments:', JSON.stringify(test.arguments, null, 2));
      
      try {
        const result = await client.callTool('calendars_get-calendar-events', test.arguments);
        
        if (result.error) {
          console.log(`❌ Error: ${result.error}`);
        } else if (result) {
          const events = Array.isArray(result) ? result : [result];
          console.log(`✅ Success! Found ${events.length} events`);
        }
      } catch (error) {
        console.error(`❌ Request failed:`, error);
      }
    }

    await client.disconnect();
  } catch (error) {
    console.error('Error creating MCP client:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Testing complete!\n');
}

// Run the test
main().catch(console.error);