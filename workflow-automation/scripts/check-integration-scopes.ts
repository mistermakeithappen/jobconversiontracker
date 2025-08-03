import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

async function checkIntegrationScopes() {
  console.log('Checking integration scopes...\n');
  
  // Get the latest integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (!integration) {
    console.error('No active GHL integration found');
    return;
  }
  
  console.log('Integration ID:', integration.id);
  console.log('Created at:', new Date(integration.created_at).toISOString());
  console.log('Updated at:', new Date(integration.updated_at).toISOString());
  console.log('\nIntegration config:', JSON.stringify(integration.config, null, 2));
  
  // Check specifically for scope information
  if (integration.config?.scope) {
    console.log('\nGranted scopes:', integration.config.scope);
    
    // Check if invoice/estimate related scopes are present
    const scopes = integration.config.scope.split(' ');
    console.log('\nScope analysis:');
    console.log('- invoices.readonly:', scopes.includes('invoices.readonly') ? '✓' : '✗');
    console.log('- invoices.write:', scopes.includes('invoices.write') ? '✓' : '✗');
    console.log('- invoices/schedule.readonly:', scopes.includes('invoices/schedule.readonly') ? '✓' : '✗');
    console.log('- invoices/schedule.write:', scopes.includes('invoices/schedule.write') ? '✓' : '✗');
    console.log('- invoices/template.readonly:', scopes.includes('invoices/template.readonly') ? '✓' : '✗');
    console.log('- invoices/template.write:', scopes.includes('invoices/template.write') ? '✓' : '✗');
  }
  
  // Check metadata
  if (integration.metadata) {
    console.log('\nIntegration metadata:', JSON.stringify(integration.metadata, null, 2));
  }
}

checkIntegrationScopes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });