#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(dirname(__dirname), '.env.local') });

// Test script to find correct parameter format for calendar events endpoint

// Hardcode for testing (from database)
const PIT_TOKEN = 'pit-c7ce3bc9-764e-421f-9fde-25e7f2f87113';
const LOCATION_ID = 'VgOeEyKgYl9vAS8IcFLx';

const MCP_ENDPOINT = 'https://services.leadconnectorhq.com/mcp/';

async function testCalendarParams(paramVariant: string, params: any) {
  console.log(`\n--- Testing variant: ${paramVariant} ---`);
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
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const contentType = response.headers.get('content-type');
    console.log('Response Content-Type:', contentType);

    if (contentType?.includes('text/event-stream')) {
      // Handle SSE response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
                console.log('Stream complete');
                return;
              }
              try {
                const json = JSON.parse(data);
                console.log('✅ SUCCESS! Response:', JSON.stringify(json, null, 2));
                return;
              } catch (e) {
                console.error('Failed to parse JSON:', data);
              }
            }
          }
        }
      }
    } else {
      // Handle regular JSON response
      const json = await response.json();
      if (json.error) {
        console.error('❌ Error:', json.error);
      } else {
        console.log('✅ SUCCESS! Response:', JSON.stringify(json, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function main() {
  // Use a test userId - you can replace this with a real one from your database
  const testUserId = 'test-user-id';
  const startTime = '2025-01-01T00:00:00Z';
  const endTime = '2025-01-31T23:59:59Z';

  console.log('Testing calendar events endpoint parameter formats...');
  console.log('Using test values:');
  console.log(`- userId: ${testUserId}`);
  console.log(`- startTime: ${startTime}`);
  console.log(`- endTime: ${endTime}`);

  // Test 1: Plain parameters (most likely based on other tools)
  await testCalendarParams('Plain parameters', {
    userId: testUserId,
    startTime: startTime,
    endTime: endTime
  });

  // Test 2: With query_ prefix
  await testCalendarParams('With query_ prefix', {
    query_userId: testUserId,
    query_startTime: startTime,
    query_endTime: endTime
  });

  // Test 3: Mixed - path userId, query times
  await testCalendarParams('Mixed - path_userId, query times', {
    path_userId: testUserId,
    query_startTime: startTime,
    query_endTime: endTime
  });

  // Test 4: All with body_ prefix
  await testCalendarParams('With body_ prefix', {
    body_userId: testUserId,
    body_startTime: startTime,
    body_endTime: endTime
  });

  // Test 5: Just startTime and endTime (no userId)
  await testCalendarParams('No userId - just times', {
    startTime: startTime,
    endTime: endTime
  });

  // Test 6: With limit parameter
  await testCalendarParams('With limit parameter', {
    userId: testUserId,
    startTime: startTime,
    endTime: endTime,
    limit: 10
  });

  console.log('\n--- All tests complete ---');
}

main().catch(console.error);