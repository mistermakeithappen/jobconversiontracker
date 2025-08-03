import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testEstimatesAPI() {
  console.log('Testing GHL Estimates API...\n');
  
  // Get an active integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .limit(1)
    .single();
    
  if (!integration || !integration.config?.encryptedTokens) {
    console.error('No active GHL integration found');
    return;
  }
  
  console.log('Found integration for organization:', integration.organization_id);
  
  // Decrypt tokens
  const tokens = JSON.parse(decrypt(integration.config.encryptedTokens));
  console.log('Location ID:', tokens.locationId);
  
  // Test the estimates endpoint directly
  const estimatesUrl = `https://services.leadconnectorhq.com/invoices/estimate/list?altId=${tokens.locationId}&altType=location&limit=10&offset=0`;
  
  console.log('\nCalling estimates endpoint:', estimatesUrl);
  
  try {
    const response = await fetch(estimatesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Version': '2021-07-28'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\nRaw response:', responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\nParsed response:', JSON.stringify(data, null, 2));
        
        // Check different possible response structures
        if (data.estimates) {
          console.log(`\nFound ${data.estimates.length} estimates in 'estimates' field`);
        } else if (data.data) {
          console.log(`\nFound ${data.data.length} items in 'data' field`);
        } else if (Array.isArray(data)) {
          console.log(`\nResponse is an array with ${data.length} items`);
        } else {
          console.log('\nUnexpected response structure');
        }
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
      }
    } else {
      console.error('API request failed');
    }
    
    // Also test invoices endpoint for comparison
    console.log('\n\n--- Testing invoices endpoint for comparison ---');
    const invoicesUrl = `https://services.leadconnectorhq.com/invoices/?altId=${tokens.locationId}&altType=location&limit=10&offset=0`;
    
    const invoiceResponse = await fetch(invoicesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Version': '2021-07-28'
      }
    });
    
    console.log('Invoice response status:', invoiceResponse.status);
    const invoiceText = await invoiceResponse.text();
    console.log('Invoice raw response:', invoiceText.substring(0, 500));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEstimatesAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });