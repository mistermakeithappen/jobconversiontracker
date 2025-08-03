#!/usr/bin/env node

async function testPagination() {
  console.log('🔍 Testing MCP pagination to find Brandon among 5000 contacts...\n');
  
  let totalContacts = 0;
  let foundBrandon = false;
  let offset = 0;
  const limit = 100;
  
  console.log('Fetching contacts in batches of', limit);
  
  while (offset < 5000 && !foundBrandon) {
    console.log(`\n📦 Fetching batch at offset ${offset}...`);
    
    const response = await fetch('http://localhost:3000/api/mcp/ghl/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'test_api', 
        method: 'getContacts',
        customParams: { limit, offset }
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.results) {
      const contactsInBatch = result.results.count || 0;
      totalContacts += contactsInBatch;
      
      console.log(`   Got ${contactsInBatch} contacts in this batch`);
      console.log(`   Total contacts so far: ${totalContacts}`);
      
      // Check if Brandon is in this batch
      if (result.results.sampleData && Array.isArray(result.results.sampleData)) {
        for (const contact of result.results.sampleData) {
          const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
          const contactName = (contact.contactName || '').toLowerCase();
          
          if (fullName.includes('brandon') || contactName.includes('brandon')) {
            console.log('\n✅ FOUND BRANDON!');
            console.log('Contact details:', contact);
            foundBrandon = true;
            break;
          }
        }
      }
      
      // If we got less than the limit, we've reached the end
      if (contactsInBatch < limit) {
        console.log('\n📊 Reached end of contacts');
        break;
      }
      
      offset += limit;
    } else {
      console.log('❌ Failed to fetch batch:', result.message);
      break;
    }
  }
  
  console.log(`\n📈 Final results:`);
  console.log(`   Total contacts checked: ${totalContacts}`);
  console.log(`   Brandon found: ${foundBrandon ? 'YES' : 'NO'}`);
}

testPagination().catch(console.error);