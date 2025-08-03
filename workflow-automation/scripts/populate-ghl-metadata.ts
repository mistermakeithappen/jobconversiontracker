import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function populateGHLMetadata() {
  console.log('🔍 Fetching existing GoHighLevel integrations...');
  
  // Get all GHL integrations
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('id, user_id, config, metadata')
    .eq('type', 'gohighlevel')
    .eq('is_active', true);
    
  if (error) {
    console.error('Error fetching integrations:', error);
    return;
  }
  
  console.log(`Found ${integrations?.length || 0} GoHighLevel integrations`);
  
  if (!integrations || integrations.length === 0) {
    console.log('No active GoHighLevel integrations found');
    return;
  }
  
  // Process each integration
  for (const integration of integrations) {
    console.log(`\nProcessing integration ${integration.id} for user ${integration.user_id}`);
    
    // Skip if metadata already populated
    if (integration.metadata && integration.metadata.location_id) {
      console.log('✅ Metadata already populated with location_id:', integration.metadata.location_id);
      continue;
    }
    
    try {
      // Check if we have config with location data
      if (integration.config) {
        console.log('Config keys:', Object.keys(integration.config));
        
        // Extract metadata from config (it's already there!)
        const metadata = {
          location_id: integration.config.locationId || integration.config.location_id || '',
          company_id: integration.config.companyId || integration.config.company_id || '',
          user_type: integration.config.userType || integration.config.user_type || '',
          scope: integration.config.scope || '',
          token_type: integration.config.tokenType || integration.config.token_type || '',
          connected_at: integration.config.connectedAt || new Date().toISOString(),
          ...(integration.metadata || {})
        };
        
        console.log('Extracted metadata:', metadata);
        
        // Update the integration with metadata
        const { error: updateError } = await supabase
          .from('integrations')
          .update({
            metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', integration.id);
          
        if (updateError) {
          console.error('Error updating integration:', updateError);
        } else {
          console.log('✅ Successfully updated metadata');
        }
      } else {
        console.log('⚠️ No config found for this integration');
      }
      
    } catch (err) {
      console.error('Error processing integration:', err);
    }
  }
  
  console.log('\n✨ Metadata population complete!');
}

// Run the script
populateGHLMetadata().catch(console.error);