import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testChatbot() {
  try {
    console.log('🚀 Testing chatbot API...');
    console.log('URL:', `${appUrl}/api/chatbot/chat`);
    
    const response = await fetch(`${appUrl}/api/chatbot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Who is Brandon Burgan? What is his phone number and email?"
      })
    });

    if (!response.ok) {
      console.error('❌ Response not OK:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response body:', text);
      return;
    }

    const data = await response.json();
    console.log('\n📬 Chatbot Response:');
    console.log(data.response);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testChatbot();