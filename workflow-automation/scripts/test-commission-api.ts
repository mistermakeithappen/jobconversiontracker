import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testCommissionAPI() {
  try {
    console.log('Testing Commission API...\n');

    const opportunityId = '8Z3XP0NEenbLDafIHJif'; // Jennifer Antonietti opportunity
    
    console.log(`1. Calling API: ${APP_URL}/api/opportunity-commissions?opportunityId=${opportunityId}`);
    
    const response = await fetch(`${APP_URL}/api/opportunity-commissions?opportunityId=${opportunityId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add test header
        'X-Test-User-Id': '2c760c74-f4ba-482c-a942-2198166b98e8'
      }
    });

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ Success!');
      console.log(`Commissions returned: ${data.commissions?.length || 0}`);
      
      if (data.commissions && data.commissions.length > 0) {
        console.log('\nCommission details:');
        data.commissions.forEach((comm: any, i: number) => {
          console.log(`\nCommission ${i + 1}:`);
          console.log(`- User: ${comm.user_name} (${comm.ghl_user_id})`);
          console.log(`- Type: ${comm.commission_type}`);
          console.log(`- Percentage: ${comm.commission_percentage}%`);
          console.log(`- Disabled: ${comm.is_disabled}`);
        });
      }
    } else {
      console.log('\n❌ Error:', data.error || 'Unknown error');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCommissionAPI();