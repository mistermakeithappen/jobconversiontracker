#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Simple decrypt function (matching the encryption.ts implementation)
function decrypt(encryptedData: string): string {
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  
  // Get encryption key and hash it
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Get MCP configuration from database
async function getMCPConfig() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
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
    locationId: integration.config.locationId,
    endpoint: integration.mcp_endpoint || 'https://services.leadconnectorhq.com/mcp/'
  };
}

// Make MCP request directly
async function makeMCPRequest(tool: string, args: any, config: any) {
  const requestId = Math.floor(Math.random() * 1000000000);
  
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${config.mcpToken}`,
      'locationId': config.locationId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args
      },
      id: requestId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  // Handle SSE response
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const json = JSON.parse(data);
          if (json.result) {
            result = json.result;
          }
        } catch (e) {
          console.error('Failed to parse:', data);
        }
      }
    }
  }

  return result;
}

// Test calendar events with contact ID
async function testCalendarWithContactId(contactId: string, config: any) {
  console.log(`🔍 Testing calendar events with contactId: ${contactId}\n`);
  
  // First, let's list tools to see the exact schema
  console.log('📋 Getting tool schema...\n');
  try {
    const requestId = Math.floor(Math.random() * 1000000000);
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${config.mcpToken}`,
        'locationId': config.locationId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: requestId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // Handle SSE response for tools/list
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let tools: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            if (json.result) {
              tools = json.result;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    if (tools?.tools) {
      const calendarTool = tools.tools.find((t: any) => t.name === 'calendars_get-calendar-events');
      
      if (calendarTool) {
        console.log('✅ Found calendar tool schema:');
        console.log(JSON.stringify(calendarTool, null, 2));
        console.log('\n' + '='.repeat(80) + '\n');
      } else {
        console.log('❌ Calendar tool not found in tools list');
      }
    }
  } catch (error) {
    console.error('Failed to list tools:', error);
  }

  // Use wider date range to find events
  const startDate = '2024-01-01';
  const endDate = '2025-12-31';
  
  const testConfigs = [
    {
      name: 'Direct contactId parameter',
      arguments: {
        startDate,
        endDate,
        contactId: contactId
      }
    },
    {
      name: 'query_contactId parameter',
      arguments: {
        startDate,
        endDate,
        query_contactId: contactId
      }
    },
    {
      name: 'path_contactId parameter',
      arguments: {
        startDate,
        endDate,
        path_contactId: contactId
      }
    },
    {
      name: 'Using attendeeId',
      arguments: {
        startDate,
        endDate,
        attendeeId: contactId
      }
    },
    {
      name: 'Using userId as contactId',
      arguments: {
        startDate,
        endDate,
        userId: contactId
      }
    },
    {
      name: 'Using assignedUserId',
      arguments: {
        startDate,
        endDate,
        assignedUserId: contactId
      }
    }
  ];

  for (const testConfig of testConfigs) {
    console.log(`\n📌 Test: ${testConfig.name}`);
    console.log('Arguments:', JSON.stringify(testConfig.arguments, null, 2));
    
    try {
      const result = await makeMCPRequest('calendars_get-calendar-events', testConfig.arguments, config);
      
      if (result) {
        const events = Array.isArray(result) ? result : (result.events || []);
        console.log(`✅ Success! Found ${events.length} events`);
        
        // Check if any events have contact association
        let hasContactField = false;
        if (events.length > 0) {
          const sampleEvent = events[0];
          const contactFields = ['contactId', 'contact_id', 'attendees', 'userId', 'assignedUserId'];
          
          for (const field of contactFields) {
            if (sampleEvent[field]) {
              hasContactField = true;
              console.log(`  - Event has ${field}: ${JSON.stringify(sampleEvent[field])}`);
            }
          }
          
          if (!hasContactField) {
            console.log('  - No contact-related fields found in events');
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
  }
}

// Get a test contact
async function getTestContact(config: any): Promise<string | null> {
  console.log('🔍 Getting a test contact...\n');
  
  try {
    const result = await makeMCPRequest('contacts_get-contacts', { limit: 5 }, config);
    
    // The response seems to be wrapped in content array with text
    let actualData = result;
    if (result?.content?.[0]?.text) {
      try {
        // Parse the nested JSON
        const parsed = JSON.parse(result.content[0].text);
        if (parsed?.content?.[0]?.text) {
          // Another level of nesting
          const innerParsed = JSON.parse(parsed.content[0].text);
          if (innerParsed?.data?.contacts) {
            actualData = innerParsed.data;
          }
        }
      } catch (e) {
        console.error('Failed to parse nested response:', e);
      }
    }
    
    if (actualData?.contacts?.length > 0) {
      const contact = actualData.contacts[0];
      console.log(`✅ Found contact: ${contact.contactName || contact.firstName || 'Unknown'} (${contact.id})\n`);
      return contact.id;
    } else if (Array.isArray(actualData) && actualData.length > 0) {
      // Sometimes the API returns an array directly
      const contact = actualData[0];
      console.log(`✅ Found contact: ${contact.contactName || contact.firstName || 'Unknown'} (${contact.id})\n`);
      return contact.id;
    }
    
    console.log('No contacts found in response');
    return null;
  } catch (error) {
    console.error('Error getting contact:', error);
    return null;
  }
}

// Test calendar events without filtering first
async function testCalendarEventsBasic(config: any) {
  console.log('📅 Testing calendar events without contact filter first...\n');
  
  try {
    const result = await makeMCPRequest('calendars_get-calendar-events', {
      startDate: '2024-01-01',
      endDate: '2025-12-31'
    }, config);
    
    if (result) {
      const events = Array.isArray(result) ? result : (result.events || []);
      console.log(`✅ Found ${events.length} total events`);
      
      if (events.length > 0) {
        console.log('\nSample event structure:');
        console.log(JSON.stringify(events[0], null, 2));
        
        // Look for any contact-related fields
        const sampleEvent = events[0];
        const possibleContactFields = [
          'contactId', 'contact_id', 'contact', 
          'attendees', 'attendee', 'participants',
          'userId', 'user_id', 'assignedUserId',
          'customerId', 'customer_id'
        ];
        
        console.log('\nChecking for contact-related fields:');
        for (const field of possibleContactFields) {
          if (sampleEvent[field] !== undefined) {
            console.log(`  ✓ Found field "${field}":`, sampleEvent[field]);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting calendar events:', error);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Main execution
async function main() {
  console.log('🚀 Testing Calendar Events with Contact ID Filtering\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Get MCP configuration
    const config = await getMCPConfig();
    console.log('✅ MCP configuration loaded\n');
    
    // First test calendar events without filtering to see the structure
    await testCalendarEventsBasic(config);
    
    // Get a test contact
    const contactId = await getTestContact(config);
    
    if (!contactId) {
      console.log('❌ No contacts found to test with');
      console.log('\n📝 Note: Even without contacts, we tested the calendar API to see the event structure.\n');
    } else {
      // Test calendar events with various parameter formats
      await testCalendarWithContactId(contactId, config);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Testing complete!\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the test
main().catch(console.error);