#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(dirname(__dirname), '.env.local') });

async function decryptPITToken() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get the API key from user_api_keys
  const { data: apiKey, error } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('id', '6018a309-8200-497d-a1d1-e33c6bef910c')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('API Key found:');
  console.log('Provider:', apiKey.provider);
  console.log('Key Name:', apiKey.key_name);
  
  if (apiKey.encrypted_key) {
    const decryptedKey = decrypt(apiKey.encrypted_key);
    console.log('PIT Token:', decryptedKey);
    
    // Also get the location ID from the integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'gohighlevel')
      .single();
      
    if (integration) {
      console.log('\nLocation ID:', integration.config.locationId);
      
      console.log('\n✅ Export these for testing:');
      console.log(`export GHL_MCP_PIT_TOKEN="${decryptedKey}"`);
      console.log(`export GHL_MCP_LOCATION_ID="${integration.config.locationId}"`);
    }
    
    // Get a test contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('contact_id, contact_name')
      .limit(1)
      .single();
      
    if (contact) {
      console.log('\nTest Contact:');
      console.log('Contact ID:', contact.contact_id);
      console.log('Contact Name:', contact.contact_name);
    }
  }
}

decryptPITToken().catch(console.error);