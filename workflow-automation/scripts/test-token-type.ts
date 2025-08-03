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

async function testTokenType() {
  console.log('Checking token type and testing estimates endpoint...\n');
  
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
  
  // Check integration config
  console.log('Integration userType:', integration.config.userType);
  console.log('Integration companyId:', integration.config.companyId);
  console.log('Integration locationId:', integration.config.locationId);
  
  // Decrypt tokens
  const tokens = JSON.parse(decrypt(integration.config.encryptedTokens));
  
  // Test the estimates endpoint with exact parameters from docs
  console.log('\n=== Testing estimates endpoint with documentation parameters ===');
  
  const params = new URLSearchParams({
    altId: integration.config.locationId,
    altType: 'location',
    limit: '10',
    offset: '0'
  });
  
  const url = `https://services.leadconnectorhq.com/invoices/estimate/list?${params}`;
  console.log('Request URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Version': '2021-07-28'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.status === 401) {
      // Try to get more info about the token
      console.log('\n=== Checking token details with /users/me ===');
      const meResponse = await fetch('https://services.leadconnectorhq.com/users/me', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Version': '2021-07-28'
        }
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('Current user:', JSON.stringify(userData, null, 2));
      } else {
        console.log('Failed to get user info:', meResponse.status);
      }
    }
  } catch (error) {
    console.error('Request error:', error);
  }
  
  // Also test if we have a Private Integration Token
  if (integration.mcp_token_encrypted) {
    console.log('\n=== Testing with MCP/Private Integration Token ===');
    const mcpToken = decrypt(integration.mcp_token_encrypted);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mcpToken}`,
          'Version': '2021-07-28'
        }
      });
      
      console.log('MCP Token response status:', response.status);
      const responseText = await response.text();
      console.log('MCP Token response:', responseText);
    } catch (error) {
      console.error('MCP request error:', error);
    }
  } else {
    console.log('\nNo MCP/Private Integration Token found');
  }
}

testTokenType()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });