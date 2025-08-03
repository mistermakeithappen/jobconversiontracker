#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(dirname(__dirname), '.env.local') });

async function getMCPTokens() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // First check integrations table structure
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .limit(1);

  if (intError) {
    console.error('Error fetching integrations:', intError);
    return;
  }
  
  console.log('Integration sample:', integrations?.[0]);
  
  if (!integrations || integrations.length === 0) {
    console.error('No integrations found');
    return;
  }
  
  const integration = integrations[0];
  
  // Check if it's a GHL integration
  if (integration.platform !== 'ghl') {
    console.log('First integration is not GHL, searching for GHL...');
    
    // Try regular GHL integration
    const { data: ghlInt, error: ghlError } = await supabase
      .from('integrations')
      .select('*')
      .eq('provider', 'ghl')
      .limit(1)
      .single();
      
    if (ghlError || !ghlInt) {
      console.error('No GHL integration found either:', ghlError);
      return;
    }
    
    console.log('Found GHL integration:', {
      userId: ghlInt.user_id,
      locationId: ghlInt.location_id,
      hasAccessToken: !!ghlInt.access_token
    });
    
    // Check for MCP settings
    if (ghlInt.private_integration_token) {
      console.log('\nFound PIT token in GHL integration!');
      console.log('Location ID:', ghlInt.location_id);
      console.log('PIT Token:', ghlInt.private_integration_token.substring(0, 20) + '...');
    }
    
    return;
  }

  console.log('Found GHL MCP integration:', {
    userId: integration.user_id,
    locationId: integration.location_id,
    hasPIT: !!integration.private_integration_token
  });

  if (integration.private_integration_token && integration.location_id) {
    console.log('\nMCP Credentials:');
    console.log('Location ID:', integration.location_id);
    console.log('PIT Token:', integration.private_integration_token.substring(0, 20) + '...');
    
    // Also get a test contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('contact_id, contact_name')
      .eq('user_id', integration.user_id)
      .limit(1)
      .single();
      
    if (contact) {
      console.log('\nTest Contact:');
      console.log('Contact ID:', contact.contact_id);
      console.log('Contact Name:', contact.contact_name);
    }
  }
}

getMCPTokens().catch(console.error);