import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testStreamlinedResponses() {
  const testCases = [
    {
      message: "Who is Brandon Burgan?",
      expected: "Should show contact details"
    },
    {
      message: "Show me Brandon Burgan's tasks",
      expected: "Should NOT show contact details, just mention checking tasks"
    },
    {
      message: "What appointments does Brandon Burgan have?",
      expected: "Should NOT show contact details, just mention checking appointments"
    },
    {
      message: "Get Brandon Burgan's outstanding invoices",
      expected: "Should NOT show contact details, just mention checking invoices"
    }
  ];

  for (const test of testCases) {
    console.log('\n' + '='.repeat(80));
    console.log(`📨 Query: "${test.message}"`);
    console.log(`📋 Expected: ${test.expected}`);
    console.log('='.repeat(80));
    
    try {
      const response = await fetch(`${appUrl}/api/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: test.message,
          conversationHistory: []
        })
      });

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText);
        continue;
      }

      const data = await response.json();
      console.log('\n🤖 Response:', data.response);
      
    } catch (error) {
      console.error('Error:', error);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  process.exit(0);
}

testStreamlinedResponses().catch(console.error);