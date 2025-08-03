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

async function testEstimatesDirect() {
  console.log('Testing estimates endpoint directly...\n');
  
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
  
  console.log('Integration created at:', new Date(integration.created_at).toISOString());
  console.log('Has required scopes:', integration.config.scope.includes('invoices/template'));
  
  // Decrypt tokens
  const tokens = JSON.parse(decrypt(integration.config.encryptedTokens));
  console.log('Location ID:', tokens.locationId);
  
  // Test different endpoints
  console.log('\n=== Testing different estimate endpoints ===');
  
  const endpoints = [
    '/invoices/estimate/list',
    '/invoices/estimates',
    '/invoices/estimate',
    '/invoices?type=estimate'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint}...`);
    const url = `https://services.leadconnectorhq.com${endpoint}?altId=${tokens.locationId}&altType=location&limit=5&offset=0`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/json',
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status:', response.status);
      const responseText = await response.text();
      
      try {
        const data = JSON.parse(responseText);
        console.log('Response:', JSON.stringify(data, null, 2).substring(0, 300));
        
        // Check if it's an array or has a data property
        if (Array.isArray(data)) {
          console.log('✓ Response is an array with', data.length, 'items');
        } else if (data.estimates) {
          console.log('✓ Response has estimates property with', data.estimates.length, 'items');
        } else if (data.data) {
          console.log('✓ Response has data property with', data.data.length, 'items');
        }
      } catch (e) {
        console.log('Raw response:', responseText.substring(0, 200));
      }
    } catch (error) {
      console.error('Request error:', error);
    }
  }
  
  // Also check if maybe estimates are under a different permission
  console.log('\n=== Checking token details ===');
  console.log('Token type:', tokens.tokenType);
  console.log('User type:', tokens.userType);
  console.log('Company ID:', tokens.companyId);
}

testEstimatesDirect()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });