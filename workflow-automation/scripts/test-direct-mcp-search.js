#!/usr/bin/env node

async function testDirectMCPSearch() {
  console.log('🔍 Testing direct MCP search for Brandon...\n');
  
  // First get integration details
  const integrationResponse = await fetch('http://localhost:3000/api/mcp/ghl/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'test_connection' })
  });
  
  const integrationData = await integrationResponse.json();
  console.log('✅ MCP Connection:', integrationData.success ? 'Connected' : 'Failed');
  console.log('📍 Location ID:', integrationData.data?.locationId);
  
  // Now test different search approaches
  console.log('\n🧪 Testing contact search with query parameter...');
  
  // Create a custom test endpoint or use the chatbot
  const searchTests = [
    { message: 'search for contacts with name Brandon', testName: 'Name search Brandon' },
    { message: 'find all contacts named Burgan', testName: 'Last name search' },
    { message: 'search contacts query Brandon', testName: 'Direct query search' },
    { message: 'get contact with phone 509-955-2545', testName: 'Phone search (location owner)' }
  ];
  
  for (const test of searchTests) {
    console.log(`\n📋 ${test.testName}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: test.message })
      });
      
      const result = await response.json();
      console.log('Response preview:', result.response.substring(0, 200) + '...');
      
      // Check if Brandon was mentioned in the response
      if (result.response.toLowerCase().includes('brandon')) {
        console.log('✅ FOUND BRANDON!');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  // Test raw MCP API
  console.log('\n🔧 Testing raw MCP contacts endpoint...');
  const rawResponse = await fetch('http://localhost:3000/api/mcp/ghl/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'test_api', 
      method: 'getContacts'
    })
  });
  
  const rawData = await rawResponse.json();
  if (rawData.success) {
    console.log(`✅ Got ${rawData.results?.count || 0} contacts`);
    console.log('Sample contacts:', rawData.results?.sampleData?.map(c => ({
      name: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone,
      email: c.email
    })));
  }
}

testDirectMCPSearch().catch(console.error);