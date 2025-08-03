#!/usr/bin/env node

async function testMCPDirect() {
  console.log('🔍 Testing MCP direct calls...\n');
  
  // First, get the token from the API
  const tokenResponse = await fetch('http://localhost:3000/api/mcp/ghl/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'debug_chatbot', debug_info: { test: 'get_token' } })
  });
  
  const tokenData = await tokenResponse.json();
  console.log('Token test response:', tokenData);
  
  // Test different parameter combinations
  const tests = [
    { name: 'No parameters', params: {} },
    { name: 'With limit only', params: { limit: 10 } },
    { name: 'With query for Brandon', params: { query: 'Brandon' } },
    { name: 'With query and limit', params: { query: 'Brandon', limit: 50 } },
    { name: 'With search term', params: { searchTerm: 'Brandon' } },
    { name: 'With name filter', params: { name: 'Brandon' } },
    { name: 'With q parameter', params: { q: 'Brandon' } },
  ];
  
  for (const test of tests) {
    console.log(`\n🧪 Test: ${test.name}`);
    console.log('Parameters:', JSON.stringify(test.params));
    
    try {
      const response = await fetch('http://localhost:3000/api/mcp/ghl/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'test_api', 
          method: 'getContacts',
          customParams: test.params  // We'll need to update the API to accept custom params
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Success: Found ${result.results?.count || 0} contacts`);
        if (result.results?.sampleData?.length > 0) {
          const sample = result.results.sampleData[0];
          console.log(`   First contact: ${sample.contactName || sample.firstName || sample.phone || 'No name'}`);
        }
      } else {
        console.log(`❌ Failed: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

testMCPDirect().catch(console.error);