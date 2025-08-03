import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testOpportunitiesSync() {
  try {
    console.log('Testing Opportunities Sync...\n');

    // First, we need to authenticate
    console.log('1. Authenticating...');
    
    // For testing, we'll use a simple approach
    // In production, this would use proper auth
    const userId = '2c760c74-f4ba-482c-a942-2198166b98e8';
    
    console.log('2. Calling opportunities endpoint...');
    console.log(`URL: ${APP_URL}/api/integrations/automake/opportunities`);
    
    const response = await fetch(`${APP_URL}/api/integrations/automake/opportunities`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add a test header to identify this request
        'X-Test-User-Id': userId
      }
    });

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ Success!');
      console.log(`Opportunities returned: ${data.opportunities?.length || 0}`);
      console.log(`Is real data: ${data.isRealData}`);
      console.log(`Cached: ${data.cached}`);
      
      if (data.opportunities && data.opportunities.length > 0) {
        console.log('\nFirst opportunity:');
        const opp = data.opportunities[0];
        console.log(`- Name: ${opp.name}`);
        console.log(`- ID: ${opp.id}`);
        console.log(`- Assigned To: ${opp.assignedTo || 'Not assigned'}`);
        console.log(`- Assigned To Name: ${opp.assignedToName || 'No name'}`);
      }
    } else {
      console.log('\n❌ Error:', data.error || 'Unknown error');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }

    // Check the database after the sync
    console.log('\n\n3. Checking database after sync...');
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count } = await supabase
      .from('opportunity_cache')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nOpportunities in cache: ${count || 0}`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testOpportunitiesSync();