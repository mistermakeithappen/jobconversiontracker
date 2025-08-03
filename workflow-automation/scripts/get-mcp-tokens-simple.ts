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
  
  // Get all integrations
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('platform', 'ghl');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('GHL Integrations found:', integrations?.length || 0);
  
  if (integrations && integrations.length > 0) {
    const int = integrations[0];
    console.log('\nFirst GHL Integration:');
    console.log('User ID:', int.user_id);
    console.log('Location ID:', int.location_id);
    console.log('Has Access Token:', !!int.access_token);
    console.log('Has PIT Token:', !!int.private_integration_token);
    
    if (int.private_integration_token && int.location_id) {
      console.log('\n✅ MCP Credentials Found!');
      console.log('export GHL_MCP_LOCATION_ID=' + int.location_id);
      console.log('export GHL_MCP_PIT_TOKEN=' + int.private_integration_token);
      
      // Get a test contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('contact_id, contact_name')
        .eq('user_id', int.user_id)
        .limit(1)
        .single();
        
      if (contact) {
        console.log('\nTest Contact for userId parameter:');
        console.log('Contact ID:', contact.contact_id);
        console.log('Contact Name:', contact.contact_name);
      }
    }
  }
}

getMCPTokens().catch(console.error);