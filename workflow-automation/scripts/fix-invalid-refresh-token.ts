import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixInvalidRefreshToken() {
  console.log('=== Fixing Invalid Refresh Token ===\n');
  
  try {
    // Get all GHL integrations
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel');
    
    if (error || !integrations || integrations.length === 0) {
      console.error('No GHL integrations found');
      return;
    }
    
    console.log(`Found ${integrations.length} GHL integration(s)\n`);
    
    for (const integration of integrations) {
      console.log(`Integration ${integration.id}:`);
      console.log(`- Organization: ${integration.organization_id}`);
      console.log(`- Active: ${integration.is_active}`);
      console.log(`- Has config: ${!!integration.config}`);
      console.log(`- Location ID: ${integration.config?.locationId || 'None'}`);
      
      // Mark integration as needing reconnection
      if (integration.is_active) {
        console.log('- Marking as needs reconnection...');
        
        const { error: updateError } = await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              needsReconnection: true,
              reconnectionReason: 'Refresh token is invalid - please reconnect to GoHighLevel',
              lastRefreshError: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
        
        if (updateError) {
          console.error('  ✗ Failed to update integration:', updateError.message);
        } else {
          console.log('  ✓ Marked for reconnection');
        }
      }
      
      console.log('');
    }
    
    console.log('\n=== Summary ===');
    console.log('The refresh token has become invalid. This usually means:');
    console.log('1. The OAuth connection was revoked in GoHighLevel');
    console.log('2. The OAuth app credentials have changed');
    console.log('3. The refresh token has expired (rare)');
    console.log('\nThe user needs to reconnect GoHighLevel from the GHL Settings page.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix script
fixInvalidRefreshToken();