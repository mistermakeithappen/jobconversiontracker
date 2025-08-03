import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testSimpleQuery() {
  console.log('🚀 Testing simple Brandon query...\n');
  
  try {
    const response = await fetch(`${appUrl}/api/chatbot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Who is Brandon?",
        conversationHistory: []
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response not OK:', response.status, response.statusText);
      console.error('Error body:', errorText);
      return;
    }

    const data = await response.json();
    console.log('🤖 Response:', data.response);
    
    // Now test conversation context
    console.log('\n🚀 Testing context - asking about his tasks...\n');
    
    const contextResponse = await fetch(`${appUrl}/api/chatbot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "What are his tasks?",
        conversationHistory: [
          { role: "user", content: "Who is Brandon?" },
          { role: "assistant", content: data.response }
        ]
      })
    });

    if (!contextResponse.ok) {
      console.error('❌ Context response not OK:', contextResponse.status);
      return;
    }

    const contextData = await contextResponse.json();
    console.log('🤖 Context Response:', contextData.response);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testSimpleQuery().catch(console.error);