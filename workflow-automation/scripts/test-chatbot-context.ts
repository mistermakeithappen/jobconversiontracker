import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testChatbotWithContext() {
  console.log('🚀 Testing chatbot with conversation context...\n');
  
  const conversationHistory: any[] = [];
  
  // First message - Ask about Brandon Burgan
  console.log('=' .repeat(80));
  console.log('📨 Message 1: "Who is Brandon Burgan?"');
  console.log('=' .repeat(80));
  
  let response = await fetch(`${appUrl}/api/chatbot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "Who is Brandon Burgan?",
      conversationHistory: conversationHistory
    })
  });

  let data = await response.json();
  console.log('🤖 Response:', data.response);
  
  // Add to conversation history
  conversationHistory.push(
    { role: "user", content: "Who is Brandon Burgan?" },
    { role: "assistant", content: data.response }
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Second message - Ask about outstanding invoices (using context)
  console.log('\n' + '=' .repeat(80));
  console.log('📨 Message 2: "Show me his outstanding invoices"');
  console.log('=' .repeat(80));
  
  response = await fetch(`${appUrl}/api/chatbot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "Show me his outstanding invoices",
      conversationHistory: conversationHistory
    })
  });

  data = await response.json();
  console.log('🤖 Response:', data.response);
  
  // Add to conversation history
  conversationHistory.push(
    { role: "user", content: "Show me his outstanding invoices" },
    { role: "assistant", content: data.response }
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Third message - Ask about appointments (still using context)
  console.log('\n' + '=' .repeat(80));
  console.log('📨 Message 3: "What about his appointments?"');
  console.log('=' .repeat(80));
  
  response = await fetch(`${appUrl}/api/chatbot/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "What about his appointments?",
      conversationHistory: conversationHistory
    })
  });

  data = await response.json();
  console.log('🤖 Response:', data.response);
  
  console.log('\n✅ Context test complete!');
  process.exit(0);
}

testChatbotWithContext().catch(console.error);