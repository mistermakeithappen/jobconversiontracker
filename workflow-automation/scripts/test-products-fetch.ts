import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
const integrationId = 'f6c7c1fd-442b-4298-be42-447aa078326d';

async function testProductsFetch() {
  console.log('Testing products fetch endpoint...\n');
  
  try {
    const response = await fetch(`http://localhost:3004/api/products/sync?integrationId=${integrationId}`, {
      headers: {
        'x-mock-user-id': mockUserId
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.products && Array.isArray(data.products)) {
      console.log(`\nFound ${data.products.length} products`);
      if (data.products.length > 0) {
        console.log('\nFirst 3 products:');
        data.products.slice(0, 3).forEach((product: any, index: number) => {
          console.log(`${index + 1}. ${product.name} - ${product.price || 'N/A'} ${product.currency}`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testProductsFetch().catch(console.error);