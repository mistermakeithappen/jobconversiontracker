import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkGHLIntegration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = '2c760c74-f4ba-482c-a942-2198166b98e8';
  const orgId = '79c6e6cf-7d7d-434e-9930-6a1d69654cd2';
  
  console.log('Checking GHL integration for org:', orgId);
  
  try {
    // Check if integration exists
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ No GHL integration found for this organization');
      } else {
        console.error('Error checking integration:', error);
      }
      return;
    }
    
    console.log('\n✓ GHL Integration found:');
    console.log('ID:', integration.id);
    console.log('Active:', integration.is_active);
    console.log('Created:', integration.created_at);
    console.log('Updated:', integration.updated_at);
    
    if (integration.config) {
      console.log('\nConfig keys:', Object.keys(integration.config));
      console.log('Has encrypted tokens:', !!integration.config.encryptedTokens);
      console.log('Location ID:', integration.config.locationId || 'Not set');
      console.log('Company ID:', integration.config.companyId || 'Not set');
      console.log('Token expires at:', integration.config.tokenExpiresAt || 'Not set');
      
      // Check if token is expired
      if (integration.config.tokenExpiresAt) {
        const expiresAt = new Date(integration.config.tokenExpiresAt);
        const now = new Date();
        if (expiresAt < now) {
          console.log('⚠️  Token is EXPIRED');
        } else {
          console.log('✓ Token is valid until:', expiresAt.toLocaleString());
        }
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkGHLIntegration();