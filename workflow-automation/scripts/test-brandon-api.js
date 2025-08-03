#!/usr/bin/env node

async function testBrandonSearch() {
  console.log('🔍 Testing Brandon search via API...\n');
  
  try {
    // Test the chatbot API directly
    const response = await fetch('http://localhost:3000/api/chatbot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'find Brandon Burgan phone number'
      })
    });
    
    const result = await response.json();
    console.log('Response:', result.response);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testBrandonSearch();