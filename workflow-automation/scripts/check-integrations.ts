import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function checkIntegrations() {
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('Checking GoHighLevel integrations...\n');
  
  // Get all integrations for the mock user
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel');
    
  if (error) {
    console.error('Error fetching integrations:', error);
    return;
  }
  
  console.log(`Found ${integrations?.length || 0} GoHighLevel integrations for user ${mockUserId}`);
  
  if (integrations && integrations.length > 0) {
    integrations.forEach(integration => {
      console.log(`\nIntegration ID: ${integration.id}`);
      console.log(`Name: ${integration.name}`);
      console.log(`Type: ${integration.type}`);
      console.log(`Active: ${integration.is_active}`);
      console.log(`Connected: ${integration.is_connected}`);
      console.log(`Created: ${new Date(integration.created_at).toLocaleString()}`);
      console.log(`Has config: ${!!integration.config}`);
      console.log(`Has encrypted tokens: ${!!integration.config?.encryptedTokens}`);
      console.log(`MCP enabled: ${integration.mcp_enabled}`);
      console.log(`Has MCP token: ${!!integration.mcp_token_encrypted}`);
      
      if (integration.config) {
        console.log('Config keys:', Object.keys(integration.config));
      }
    });
    
    // Check if we have products synced
    console.log('\nChecking for synced products...');
    
    for (const integration of integrations) {
      const { data: products, error: productsError } = await supabase
        .from('ghl_products')
        .select('*')
        .eq('user_id', mockUserId)
        .eq('integration_id', integration.id);
        
      if (productsError) {
        console.error(`Error fetching products for integration ${integration.id}:`, productsError);
      } else {
        console.log(`Integration ${integration.id} has ${products?.length || 0} synced products`);
        
        if (products && products.length > 0) {
          console.log('Sample products:');
          products.slice(0, 3).forEach(product => {
            console.log(`- ${product.name} (${product.ghl_product_id}) - $${product.price} ${product.currency}`);
          });
        }
      }
    }
  } else {
    console.log('No GoHighLevel integrations found. You may need to connect first.');
  }
}

checkIntegrations().catch(console.error);