import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testGHLProductsAPI() {
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get the integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel')
    .single();
    
  if (!integration?.config?.encryptedTokens) {
    console.error('No integration found');
    return;
  }
  
  const decryptedTokens = JSON.parse(decrypt(integration.config.encryptedTokens));
  const locationId = integration.config.locationId;
  
  console.log('Testing GoHighLevel Products API directly...\n');
  console.log('LocationId:', locationId);
  
  // Test different API variations
  const apiTests = [
    {
      name: 'Products with locationId parameter',
      url: `https://services.leadconnectorhq.com/products/?locationId=${locationId}&limit=10`
    },
    {
      name: 'Products without parameters',
      url: `https://services.leadconnectorhq.com/products/`
    },
    {
      name: 'Location-specific products endpoint',
      url: `https://services.leadconnectorhq.com/locations/${locationId}/products`
    },
    {
      name: 'Products search endpoint',
      url: `https://services.leadconnectorhq.com/products/search?locationId=${locationId}`
    }
  ];
  
  for (const test of apiTests) {
    console.log(`\n--- Testing: ${test.name} ---`);
    console.log(`URL: ${test.url}`);
    
    try {
      const response = await fetch(test.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedTokens.accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Status:', response.status, response.statusText);
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
        console.log('Response:', JSON.stringify(data, null, 2));
      } catch {
        console.log('Response (text):', text);
      }
      
      // Check if we got products
      if (data && (data.products || Array.isArray(data))) {
        const products = data.products || data;
        console.log(`Found ${products.length} products`);
        if (products.length > 0) {
          console.log('First product:', JSON.stringify(products[0], null, 2));
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

testGHLProductsAPI().catch(console.error);