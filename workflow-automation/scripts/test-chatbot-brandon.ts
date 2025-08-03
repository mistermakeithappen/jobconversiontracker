import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testChatbotQueries() {
  const queries = [
    "List all contacts named Brandon",
    "Who is Brandon Burgan?",
    "Find Brandon",
    "What is Brandon Burgan's phone number?"
  ];

  for (const query of queries) {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 Query: "${query}"`);
    console.log('='.repeat(80));
    
    try {
      const response = await fetch(`${appUrl}/api/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query
        })
      });

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText);
        continue;
      }

      const data = await response.json();
      console.log('\n📬 Response:');
      console.log(data.response);
      
    } catch (error) {
      console.error('Error:', error);
    }
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  process.exit(0);
}

testChatbotQueries();