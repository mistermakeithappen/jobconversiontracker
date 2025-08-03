import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GHL API configuration
const GHL_CONFIG = {
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  apiVersion: '2021-07-28'
};

async function testProductsFetch() {
  console.log('Testing GoHighLevel products fetch...\n');

  try {
    // Get an active GHL integration
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .limit(1);

    if (intError || !integrations || integrations.length === 0) {
      console.error('No active GoHighLevel integration found');
      return;
    }

    const integration = integrations[0];
    console.log('Using integration:', integration.id);
    console.log('Location ID:', integration.config?.locationId);

    // Decrypt tokens
    const encryptedTokens = integration.config?.encryptedTokens;
    if (!encryptedTokens) {
      console.error('No encrypted tokens found');
      return;
    }

    const tokensStr = decrypt(encryptedTokens);
    const tokens = JSON.parse(tokensStr);
    console.log('Access token available:', !!tokens.access_token);

    // Fetch products directly from GHL API
    const url = `${GHL_CONFIG.apiBaseUrl}/products/?locationId=${integration.config.locationId}&limit=10`;
    console.log('\nFetching from URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Version': GHL_CONFIG.apiVersion,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error body:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n=== RAW API RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    // Try to parse products
    const products = data.products || data.data || data || [];
    console.log(`\n=== Found ${products.length} products ===\n`);

    // Examine first product structure in detail
    if (products.length > 0) {
      console.log('=== FIRST PRODUCT STRUCTURE ===');
      const firstProduct = products[0];
      console.log(JSON.stringify(firstProduct, null, 2));

      console.log('\n=== PRICE INFORMATION ===');
      console.log('Direct price field:', firstProduct.price);
      console.log('Prices array:', firstProduct.prices);
      console.log('Amount field:', firstProduct.amount);
      console.log('Price data field:', firstProduct.priceData);
      console.log('Default price:', firstProduct.defaultPrice);
      
      // Check all possible price locations
      const possiblePriceFields = [
        'price',
        'amount',
        'defaultPrice',
        'unitAmount',
        'unit_amount',
        'priceAmount',
        'price_amount'
      ];

      console.log('\n=== CHECKING ALL POSSIBLE PRICE FIELDS ===');
      for (const field of possiblePriceFields) {
        if (firstProduct[field] !== undefined) {
          console.log(`${field}:`, firstProduct[field]);
        }
      }

      // Check nested structures
      if (firstProduct.priceData) {
        console.log('\n=== PRICE DATA STRUCTURE ===');
        console.log(JSON.stringify(firstProduct.priceData, null, 2));
      }

      if (firstProduct.prices && Array.isArray(firstProduct.prices)) {
        console.log('\n=== PRICES ARRAY STRUCTURE ===');
        firstProduct.prices.forEach((price: any, index: number) => {
          console.log(`Price ${index + 1}:`, JSON.stringify(price, null, 2));
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testProductsFetch().then(() => {
  console.log('\nTest complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});