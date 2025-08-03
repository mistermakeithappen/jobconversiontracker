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

async function testGHLAPIVersion() {
  console.log('Testing GHL API versions and endpoints...\n');
  
  // Get the latest integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (!integration || !integration.config?.encryptedTokens) {
    console.error('No active GHL integration found');
    return;
  }
  
  // Decrypt tokens
  const tokens = JSON.parse(decrypt(integration.config.encryptedTokens));
  console.log('Location ID:', tokens.locationId);
  
  // Test with different API versions
  const versions = ['2021-04-15', '2021-07-28', '2024-01-01'];
  
  for (const version of versions) {
    console.log(`\n=== Testing with API Version: ${version} ===`);
    
    // Test invoices endpoint first (known to work)
    console.log('\nTesting invoices endpoint...');
    try {
      const invoiceResponse = await fetch(
        `https://services.leadconnectorhq.com/invoices/?altId=${tokens.locationId}&altType=location&limit=1&offset=0`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Accept': 'application/json',
            'Version': version
          }
        }
      );
      console.log('Invoices status:', invoiceResponse.status);
    } catch (e) {
      console.error('Invoice error:', e);
    }
    
    // Test estimates endpoint
    console.log('\nTesting estimates endpoint...');
    try {
      const estimateResponse = await fetch(
        `https://services.leadconnectorhq.com/invoices/estimate/list?altId=${tokens.locationId}&altType=location&limit=1&offset=0`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Accept': 'application/json',
            'Version': version
          }
        }
      );
      console.log('Estimates status:', estimateResponse.status);
      
      if (estimateResponse.status !== 200) {
        const errorData = await estimateResponse.json();
        console.log('Error:', errorData.message || errorData);
      } else {
        console.log('✓ Success! Estimates work with version:', version);
        const data = await estimateResponse.json();
        console.log('Response structure:', Object.keys(data));
      }
    } catch (e) {
      console.error('Estimate error:', e);
    }
  }
  
  // Try without version header
  console.log('\n=== Testing without Version header ===');
  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/invoices/estimate/list?altId=${tokens.locationId}&altType=location&limit=1&offset=0`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
  
  // Check if it's a plan limitation
  console.log('\n=== Checking user/location details ===');
  try {
    const meResponse = await fetch(
      'https://services.leadconnectorhq.com/users/me',
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    if (meResponse.ok) {
      const userData = await meResponse.json();
      console.log('User data:', JSON.stringify(userData, null, 2).substring(0, 500));
    }
  } catch (e) {
    console.error('User fetch error:', e);
  }
}

testGHLAPIVersion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });