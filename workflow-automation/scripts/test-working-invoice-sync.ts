import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '../lib/utils/encryption';

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

async function testWorkingInvoiceSync() {
  console.log('Testing working invoice sync...\n');
  
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
  
  // Create GHL client using the same method as the sync routes
  const mcpToken = integration.mcp_enabled && integration.mcp_token_encrypted ? 
    decrypt(integration.mcp_token_encrypted) : undefined;
    
  const ghlClient = await createGHLClient(
    integration.config.encryptedTokens,
    async (newTokens) => {
      const encryptedTokens = encrypt(JSON.stringify(newTokens));
      await supabase
        .from('integrations')
        .update({
          config: {
            ...integration.config,
            encryptedTokens,
            lastTokenRefresh: new Date().toISOString()
          }
        })
        .eq('id', integration.id);
    },
    mcpToken
  );
  
  console.log('GHL Client Location ID:', ghlClient.getLocationId());
  
  // Test invoices (working)
  console.log('\n=== Testing getInvoices method ===');
  try {
    const invoiceResponse = await ghlClient.getInvoices({
      limit: 5,
      offset: 0
    });
    console.log('Invoice response:', JSON.stringify(invoiceResponse, null, 2).substring(0, 500));
    
    if (invoiceResponse.invoices) {
      console.log(`\nFound ${invoiceResponse.invoices.length} invoices`);
    }
  } catch (error: any) {
    console.error('Invoice error:', error.message);
  }
  
  // Test estimates
  console.log('\n=== Testing getEstimates method ===');
  try {
    const estimateResponse = await ghlClient.getEstimates({
      limit: 5,
      offset: 0
    });
    console.log('Estimate response:', JSON.stringify(estimateResponse, null, 2).substring(0, 500));
    
    if (estimateResponse.estimates) {
      console.log(`\nFound ${estimateResponse.estimates.length} estimates`);
    }
  } catch (error: any) {
    console.error('Estimate error:', error.message);
    console.error('Error details:', {
      statusCode: error.statusCode,
      status: error.status,
      response: error.response
    });
  }
}

testWorkingInvoiceSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });