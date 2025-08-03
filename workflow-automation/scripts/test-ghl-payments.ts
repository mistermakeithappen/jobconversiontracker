import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testGHLPaymentsAPI() {
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
  
  console.log('Testing GoHighLevel Payments API directly...\n');
  console.log('LocationId:', locationId);
  console.log('Current scopes:', integration.config.scope);
  
  // Test the transactions endpoint
  const url = `https://services.leadconnectorhq.com/payments/transactions?locationId=${locationId}&limit=10`;
  console.log('\nFetching transactions from:', url);
  
  try {
    const response = await fetch(url, {
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
    
    // If we get an auth error, it's likely missing the payments scope
    if (response.status === 401 || response.status === 403) {
      console.log('\n⚠️  Authorization failed. You may need to reconnect with the payments.readonly scope.');
      console.log('Current integration does not have payments.readonly scope.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGHLPaymentsAPI().catch(console.error);