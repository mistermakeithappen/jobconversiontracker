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
  
  console.log('Testing GoHighLevel Invoices & Subscriptions APIs...\n');
  console.log('LocationId:', locationId);
  console.log('Current scopes:', integration.config.scope);
  
  // Test invoices endpoint
  console.log('\n--- Testing Invoices API ---');
  const invoiceUrl = `https://services.leadconnectorhq.com/invoices/?locationId=${locationId}&limit=10&status=paid`;
  console.log('URL:', invoiceUrl);
  
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
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.invoices || data.data) {
      const invoices = data.invoices || data.data || [];
      console.log(`Found ${invoices.length} invoices`);
      if (invoices.length > 0) {
        console.log('First invoice:', JSON.stringify(invoices[0], null, 2));
      }
    }
  } catch (error) {
    console.error('Invoice API Error:', error);
  }
  
  // Test subscriptions endpoint
  console.log('\n--- Testing Subscriptions API ---');
  const subsUrl = `https://services.leadconnectorhq.com/payments/subscriptions?locationId=${locationId}&limit=10&status=active`;
  console.log('URL:', subsUrl);
  
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
    
    if (data.subscriptions || data.data) {
      const subs = data.subscriptions || data.data || [];
      console.log(`Found ${subs.length} subscriptions`);
    }
  } catch (error) {
    console.error('Subscription API Error:', error);
  }
}

testGHLInvoicesAPI().catch(console.error);