import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testTasksQuery() {
  console.log('🚀 Testing Brandon Burgan tasks query...\n');
  
  try {
    const response = await fetch(`${appUrl}/api/chatbot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Show me Brandon Burgan's tasks",
        conversationHistory: []
      })
    });

    if (!response.ok) {
      console.error('❌ Response not OK:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('🤖 Response:', data.response);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testTasksQuery().catch(console.error);