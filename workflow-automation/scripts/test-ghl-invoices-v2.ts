import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testGHLInvoicesAPI() {
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
  
  console.log('Testing GoHighLevel APIs with different approaches...\n');
  console.log('LocationId:', locationId);
  
  // Test invoices with different endpoint
  console.log('\n--- Testing Invoices API (without status filter) ---');
  const invoiceUrl = `https://services.leadconnectorhq.com/invoices/?locationId=${locationId}&limit=10`;
  
  try {
    const response = await fetch(invoiceUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedTokens.accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (response.status === 403) {
      console.log('\n⚠️  Invoices API returned 403 Forbidden');
      console.log('This might mean:');
      console.log('1. The invoices.readonly scope is not sufficient');
      console.log('2. Invoices require a different API approach');
      console.log('3. Your app might need additional permissions in GoHighLevel');
    } else {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Invoice API Error:', error);
  }
  
  // Test subscriptions with required parameters
  console.log('\n--- Testing Subscriptions API (with altId/altType) ---');
  const subsUrl = `https://services.leadconnectorhq.com/payments/subscriptions?altId=${locationId}&altType=location&limit=10`;
  
  try {
    const response = await fetch(subsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedTokens.accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.subscriptions || Array.isArray(data)) {
      const subs = data.subscriptions || data || [];
      console.log(`\nFound ${subs.length} subscriptions`);
      if (subs.length > 0) {
        console.log('First subscription:', JSON.stringify(subs[0], null, 2));
      }
    }
  } catch (error) {
    console.error('Subscription API Error:', error);
  }
  
  // Test transactions API one more time
  console.log('\n--- Testing Transactions API ---');
  const transUrl = `https://services.leadconnectorhq.com/payments/transactions?locationId=${locationId}&limit=10`;
  
  try {
    const response = await fetch(transUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedTokens.accessToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Transactions API Error:', error);
  }
}

testGHLInvoicesAPI().catch(console.error);