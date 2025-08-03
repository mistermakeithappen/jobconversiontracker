import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const integrationId = 'f6c7c1fd-442b-4298-be42-447aa078326d';
const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
const locationId = 'VgOeEyKgYl9vAS8IcFLx';
const companyId = 'rhggb6a9G8n9e9AI5rpT';

async function fetchGHLDetails() {
  console.log('🔍 Fetching additional GoHighLevel details...\n');
  
  const url = 'http://localhost:3000/api/integrations/automake/fetch-details';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        userId,
        locationId,
        companyId
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Request failed:', response.status, error);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Details fetched successfully!');
    console.log('\n📋 Fetched Details:');
    console.log('Location Name:', result.details.locationName || 'Not found');
    console.log('User Name:', result.details.userName || 'Not found');
    console.log('Company Name:', result.details.companyName || 'Not found');
    console.log('Pipelines:', result.details.pipelines || 0);
    console.log('Accessible Locations:', result.details.accessibleLocations || 0);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fetch
fetchGHLDetails().catch(console.error);