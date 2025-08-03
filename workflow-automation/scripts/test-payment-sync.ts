import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
const integrationId = 'f6c7c1fd-442b-4298-be42-447aa078326d';

async function testPaymentSync() {
  console.log('Testing payment sync endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:3004/api/sales/sync-payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-user-id': mockUserId
      },
      body: JSON.stringify({ integrationId })
    });
    
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testPaymentSync().catch(console.error);