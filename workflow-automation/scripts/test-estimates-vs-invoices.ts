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

async function testBothEndpoints() {
  console.log('Testing GHL Estimates vs Invoices API...\n');
  
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
  console.log('Token expires at:', new Date(tokens.expiresAt).toISOString());
  
  const headers = {
    'Authorization': `Bearer ${tokens.accessToken}`,
    'Accept': 'application/json',
    'Version': '2021-07-28'
  };
  
  // Test 1: Invoices endpoint (working)
  console.log('\n=== Testing INVOICES endpoint ===');
  const invoicesUrl = `https://services.leadconnectorhq.com/invoices/?altId=${tokens.locationId}&altType=location&limit=5`;
  
  try {
    const response = await fetch(invoicesUrl, { method: 'GET', headers });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response structure:', Object.keys(data));
    if (data.invoices) {
      console.log(`Found ${data.invoices.length} invoices`);
    }
  } catch (error) {
    console.error('Invoice error:', error);
  }
  
  // Test 2: Estimates endpoint with different variations
  console.log('\n=== Testing ESTIMATES endpoint variations ===');
  
  // Variation 1: /invoices/estimate/list
  console.log('\n1. Testing /invoices/estimate/list');
  const estimatesUrl1 = `https://services.leadconnectorhq.com/invoices/estimate/list?altId=${tokens.locationId}&altType=location&limit=5`;
  
  try {
    const response = await fetch(estimatesUrl1, { method: 'GET', headers });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Variation 2: /invoices/estimates (plural)
  console.log('\n2. Testing /invoices/estimates');
  const estimatesUrl2 = `https://services.leadconnectorhq.com/invoices/estimates?altId=${tokens.locationId}&altType=location&limit=5`;
  
  try {
    const response = await fetch(estimatesUrl2, { method: 'GET', headers });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Variation 3: /invoices with type filter
  console.log('\n3. Testing /invoices with type=estimate filter');
  const estimatesUrl3 = `https://services.leadconnectorhq.com/invoices/?altId=${tokens.locationId}&altType=location&type=estimate&limit=5`;
  
  try {
    const response = await fetch(estimatesUrl3, { method: 'GET', headers });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test 3: Check token scopes
  console.log('\n=== Checking integration metadata ===');
  console.log('Integration config:', {
    ...integration.config,
    encryptedTokens: '[REDACTED]'
  });
  console.log('Metadata:', integration.metadata);
}

testBothEndpoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });