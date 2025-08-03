import { createClient } from '@supabase/supabase-js';
import { GHLClient } from '../lib/integrations/gohighlevel/client';
import { decrypt } from '../lib/utils/encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testResponseStructure() {
  try {
    // Get GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      console.error('No active GoHighLevel integration found');
      return;
    }

    // Decrypt tokens
    const decryptedTokens = decrypt(integration.config.encryptedTokens);
    const tokens = JSON.parse(decryptedTokens);

    // Create GHL client
    const client = new GHLClient({
      accessToken: tokens.accessToken || tokens.access_token,
      refreshToken: tokens.refreshToken || tokens.refresh_token,
      expiresAt: tokens.expiresAt || integration.expires_at || new Date(Date.now() + 3600000).toISOString(),
      locationId: integration.config.locationId,
      companyId: integration.config.companyId,
      userId: tokens.userId || integration.config.userId
    }, async (newTokens) => {
      console.log('Token refreshed');
    });

    console.log(`🔍 Testing GHL API response structure`);
    console.log('=' .repeat(80));

    // First batch without startAfterId
    console.log('\n📦 Fetching first batch...');
    const firstResponse = await client.getContacts({ limit: 20 });
    
    console.log('\n📋 Response structure:');
    console.log('Type:', typeof firstResponse);
    console.log('Is Array:', Array.isArray(firstResponse));
    console.log('Keys:', Object.keys(firstResponse));
    
    if (firstResponse.contacts) {
      console.log('\n✅ Has contacts property');
      console.log('Contacts count:', firstResponse.contacts.length);
      console.log('First contact ID:', firstResponse.contacts[0]?.id);
      console.log('Last contact ID:', firstResponse.contacts[firstResponse.contacts.length - 1]?.id);
    }
    
    if (firstResponse.meta) {
      console.log('\n📊 Meta information:');
      console.log(JSON.stringify(firstResponse.meta, null, 2));
    }

    // Try second batch with startAfterId
    if (firstResponse.contacts && firstResponse.contacts.length > 0) {
      const lastId = firstResponse.contacts[firstResponse.contacts.length - 1].id;
      console.log(`\n📦 Fetching second batch with startAfterId: ${lastId}...`);
      
      const secondResponse = await client.getContacts({ 
        limit: 20, 
        startAfterId: lastId 
      });
      
      console.log('\n📋 Second response:');
      console.log('Contacts count:', secondResponse.contacts?.length || 0);
      if (secondResponse.contacts && secondResponse.contacts.length > 0) {
        console.log('First contact ID:', secondResponse.contacts[0]?.id);
        console.log('First contact name:', secondResponse.contacts[0]?.contactName);
        
        // Check if it's the same contacts
        if (secondResponse.contacts[0]?.id === firstResponse.contacts[0]?.id) {
          console.log('\n❌ ERROR: Second batch returned the same contacts as first batch!');
          console.log('This indicates pagination is not working correctly.');
        } else {
          console.log('\n✅ Pagination working correctly - different contacts returned');
        }
      }
      
      if (secondResponse.meta) {
        console.log('\n📊 Second batch meta:');
        console.log(JSON.stringify(secondResponse.meta, null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testResponseStructure();