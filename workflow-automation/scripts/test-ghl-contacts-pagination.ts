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

async function testContactsPagination() {
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

    // Create GHL client - handle both camelCase and snake_case
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

    console.log(`🔍 Testing contact pagination for location: ${integration.config.locationId}`);
    console.log('=' .repeat(80));

    let totalContacts = 0;
    let batches = 0;
    let hasMore = true;
    let startAfterId: string | undefined;

    while (hasMore) {
      batches++;
      console.log(`\n📦 Fetching batch ${batches}...`);
      
      try {
        const response = await client.getContacts({
          limit: 100,
          startAfterId
        });

        // Handle both array response and object with contacts property
        const batch = Array.isArray(response) ? response : response?.contacts;

        if (!batch || !Array.isArray(batch)) {
          console.log('❌ Invalid response format:', response);
          hasMore = false;
          break;
        }

        if (batch.length === 0) {
          console.log('✅ No more contacts to fetch');
          hasMore = false;
          break;
        }

        console.log(`✅ Received ${batch.length} contacts`);
        totalContacts += batch.length;

        // Show first contact of each batch
        if (batch[0]) {
          console.log(`   First contact: ${batch[0].firstName} ${batch[0].lastName} (${batch[0].id})`);
        }
        
        // Show last contact of each batch
        if (batch[batch.length - 1]) {
          console.log(`   Last contact: ${batch[batch.length - 1].firstName} ${batch[batch.length - 1].lastName} (${batch[batch.length - 1].id})`);
        }

        // Set up for next batch
        startAfterId = batch[batch.length - 1].id;
        console.log(`   Next startAfterId: ${startAfterId}`);
        
        // If we got less than the limit, we're done
        if (batch.length < 100) {
          console.log(`✅ Received less than limit (${batch.length} < 100), assuming no more contacts`);
          hasMore = false;
        }

      } catch (error) {
        console.error('❌ Error fetching batch:', error);
        hasMore = false;
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log(`📊 Total Summary:`);
    console.log(`   Batches fetched: ${batches}`);
    console.log(`   Total contacts: ${totalContacts}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testContactsPagination();