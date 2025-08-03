const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testChatbotAppointments() {
  const baseUrl = 'http://localhost:3000';
  const endpoint = '/api/chatbot/chat';
  
  const requestBody = {
    message: 'what appointments does brandon burgan have?',
    conversationHistory: []
  };

  console.log('Testing chatbot appointments query...');
  console.log('Request:', {
    url: `${baseUrl}${endpoint}`,
    body: requestBody
  });

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `mock-user-id=${MOCK_USER_ID}` // Simulate authenticated request
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    // Check if response is streaming
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      console.log('Streaming response detected...');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
      }

      console.log('\n\nFull streaming response:', fullResponse);
    } else {
      // Regular JSON response
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Run the test
console.log('Starting chatbot appointments test...');
console.log('Make sure the dev server is running on port 3000');
console.log('Mock user ID:', MOCK_USER_ID);
console.log('---');

testChatbotAppointments()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });