#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(dirname(__dirname), '.env.local') });

// Hardcode for testing (from database)
const PIT_TOKEN = 'pit-c7ce3bc9-764e-421f-9fde-25e7f2f87113';
const LOCATION_ID = 'VgOeEyKgYl9vAS8IcFLx';
const MCP_ENDPOINT = 'https://services.leadconnectorhq.com/mcp/';

async function testWithRealUser() {
  // First, let's try to get a real user ID from the location
  console.log('Testing calendar events with query_ prefix and real dates...\n');

  const startTime = '2025-01-01T00:00:00Z';
  const endTime = '2025-01-31T23:59:59Z';

  // Test without userId first (should fail but with different error)
  console.log('Test 1: Without userId (using query_ prefix)');
  const params1 = {
    query_startTime: startTime,
    query_endTime: endTime
  };

  await makeRequest('No userId', params1);

  // Test with the location's users
  console.log('\nTest 2: Try to get location users first');
  const getUsersResponse = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${PIT_TOKEN}`,
      'locationId': LOCATION_ID,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'locations_get-location',
        arguments: {}
      },
      id: Date.now()
    })
  });

  if (getUsersResponse.ok) {
    const responseText = await readSSEResponse(getUsersResponse);
    console.log('Location data:', responseText);
  }

  // Test with calendarId instead of userId
  console.log('\nTest 3: With calendarId instead of userId');
  const params3 = {
    query_calendarId: 'test-calendar-id',
    query_startTime: startTime,
    query_endTime: endTime
  };

  await makeRequest('CalendarId test', params3);
}

async function makeRequest(testName: string, params: any) {
  console.log(`\n--- ${testName} ---`);
  console.log('Parameters:', JSON.stringify(params, null, 2));

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${PIT_TOKEN}`,
        'locationId': LOCATION_ID,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'calendars_get-calendar-events',
          arguments: params
        },
        id: Date.now()
      })
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await readSSEResponse(response);
    console.log('Result:', result);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

async function readSSEResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return result;
          }
          try {
            const json = JSON.parse(data);
            // Extract the nested text content
            if (json.result?.content?.[0]?.text) {
              result = json.result.content[0].text;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
  return result;
}

testWithRealUser().catch(console.error);