import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function checkGHLLocation() {
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('Checking GoHighLevel integration details...\n');
  
  // Get the integration
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel')
    .single();
    
  if (error) {
    console.error('Error fetching integration:', error);
    return;
  }
  
  if (!integration) {
    console.log('No GoHighLevel integration found');
    return;
  }
  
  console.log('Integration ID:', integration.id);
  console.log('Integration Name:', integration.name);
  console.log('Active:', integration.is_active);
  console.log('\nConfig keys:', Object.keys(integration.config || {}));
  
  if (integration.config) {
    console.log('\nConfig details:');
    console.log('- locationId:', integration.config.locationId);
    console.log('- companyId:', integration.config.companyId);
    console.log('- userType:', integration.config.userType);
    console.log('- scope:', integration.config.scope);
    console.log('- connectedAt:', integration.config.connectedAt);
    console.log('- Has encrypted tokens:', !!integration.config.encryptedTokens);
    
    // Decrypt and check token details
    if (integration.config.encryptedTokens) {
      try {
        const decryptedTokens = JSON.parse(decrypt(integration.config.encryptedTokens));
        console.log('\nDecrypted token info:');
        console.log('- Has accessToken:', !!decryptedTokens.accessToken);
        console.log('- Has refreshToken:', !!decryptedTokens.refreshToken);
        console.log('- LocationId in tokens:', decryptedTokens.locationId);
        console.log('- CompanyId in tokens:', decryptedTokens.companyId);
        console.log('- UserId in tokens:', decryptedTokens.userId);
        console.log('- Token expires at:', new Date(decryptedTokens.expiresAt).toISOString());
        console.log('- Token expired:', new Date(decryptedTokens.expiresAt) < new Date());
      } catch (err) {
        console.error('Error decrypting tokens:', err);
      }
    }
  }
  
  // Also check if products table exists and has data
  console.log('\nChecking products table...');
  const { data: products, error: productsError } = await supabase
    .from('ghl_products')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('integration_id', integration.id);
    
  if (productsError) {
    console.error('Error fetching products:', productsError);
  } else {
    console.log(`Found ${products?.length || 0} products in database`);
    if (products && products.length > 0) {
      console.log('\nSample products:');
      products.slice(0, 3).forEach(p => {
        console.log(`- ${p.name} (GHL ID: ${p.ghl_product_id})`);
      });
    }
  }
}

checkGHLLocation().catch(console.error);