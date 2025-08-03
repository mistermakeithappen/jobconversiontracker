import * as dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { createGHLMCPClient } from '../lib/mcp/ghl-mcp-client';
import { getServiceSupabase } from '../lib/supabase/client';
import { decrypt } from '../lib/utils/encryption';

async function searchForBrandon() {
  console.log('🔍 Searching for Brandon Burgan...\n');
  
  const supabase = getServiceSupabase();
  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5'; // Mock user ID
  
  // Get integration
  const { data: integration, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .single();
    
  if (intError || !integration) {
    console.error('❌ No active GHL integration found');
    return;
  }
  
  // Get MCP token
  const { data: apiKey, error: keyError } = await supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', userId)
    .eq('provider', 'ghlmcp')
    .eq('is_active', true)
    .single();
    
  if (keyError || !apiKey) {
    console.error('❌ No active MCP token found');
    return;
  }
  
  const mcpToken = decrypt(apiKey.encrypted_key);
  console.log('✅ Found MCP token (first 10 chars):', mcpToken.substring(0, 10));
  console.log('📍 Location ID:', integration.config.locationId);
  
  // Create MCP client
  const client = await createGHLMCPClient({
    mcpToken,
    locationId: integration.config.locationId
  });
  
  if (!client) {
    console.error('❌ Failed to create MCP client');
    return;
  }
  
  try {
    // Search with different approaches
    console.log('\n1️⃣ Searching with query "Brandon Burgan"...');
    const searchResult1 = await client.getContacts({ 
      query: 'Brandon Burgan',
      limit: 100 
    });
    console.log('Results:', Array.isArray(searchResult1) ? searchResult1.length : 'Not an array');
    if (Array.isArray(searchResult1) && searchResult1.length > 0) {
      console.log('First few results:', searchResult1.slice(0, 3).map((c: any) => ({
        id: c.id,
        name: c.contactName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'No name',
        email: c.email,
        phone: c.phone
      })));
    }
    
    console.log('\n2️⃣ Searching with query "Brandon"...');
    const searchResult2 = await client.getContacts({ 
      query: 'Brandon',
      limit: 100 
    });
    console.log('Results:', Array.isArray(searchResult2) ? searchResult2.length : 'Not an array');
    
    console.log('\n3️⃣ Getting all contacts (no query)...');
    const allContacts = await client.getContacts({ limit: 100 });
    console.log('Total contacts:', Array.isArray(allContacts) ? allContacts.length : 'Not an array');
    
    if (Array.isArray(allContacts)) {
      // Search through all contacts for Brandon
      const brandon = allContacts.find((c: any) => {
        const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const contactName = (c.contactName || '').toLowerCase();
        return fullName.includes('brandon') || contactName.includes('brandon');
      });
      
      if (brandon) {
        console.log('\n✅ Found Brandon:', brandon);
      } else {
        console.log('\n⚠️ Brandon not found in the first 100 contacts');
        
        // Show contacts that have actual names
        const namedContacts = allContacts.filter((c: any) => c.firstName || c.lastName);
        console.log(`\nContacts with names (${namedContacts.length} total):`);
        namedContacts.slice(0, 10).forEach((c: any) => {
          console.log(`- ${c.firstName || ''} ${c.lastName || ''} (${c.email || 'no email'}) ${c.phone || 'no phone'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error during search:', error);
  } finally {
    await client.disconnect();
  }
}

// Run the search
searchForBrandon().catch(console.error);