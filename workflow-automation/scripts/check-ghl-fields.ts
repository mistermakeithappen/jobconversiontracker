import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function checkGHLFields() {
  console.log('🔍 Checking GoHighLevel integration fields...\n');
  
  // Get the GHL integration
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .single();
    
  if (error) {
    console.error('Error fetching integration:', error);
    return;
  }
  
  if (!integration) {
    console.log('No active GoHighLevel integration found');
    return;
  }
  
  console.log('✅ Found GoHighLevel integration');
  console.log('\n📋 Integration Details:');
  console.log('ID:', integration.id);
  console.log('Created:', new Date(integration.created_at).toLocaleString());
  console.log('Updated:', new Date(integration.updated_at).toLocaleString());
  console.log('MCP Enabled:', integration.mcp_enabled);
  
  if (integration.config) {
    console.log('\n🔧 Configuration Fields:');
    const config = integration.config;
    
    // Core IDs
    console.log('\n[Core IDs]');
    console.log('Location ID:', config.locationId || '❌ NOT SET');
    console.log('Company ID:', config.companyId || '❌ NOT SET');
    console.log('User ID:', config.userId || '❌ NOT SET');
    
    // User Information
    console.log('\n[User Information]');
    console.log('User Type:', config.userType || '❌ NOT SET');
    console.log('User Name:', config.userName || '❌ NOT SET');
    console.log('User Email:', config.userEmail || config.email || '❌ NOT SET');
    console.log('User Role:', config.userRole || '❌ NOT SET');
    console.log('User Phone:', config.userPhone || '❌ NOT SET');
    
    // Location Details
    console.log('\n[Location Details]');
    console.log('Location Name:', config.locationName || '❌ NOT SET');
    console.log('Location Timezone:', config.locationTimezone || '❌ NOT SET');
    console.log('Location Phone:', config.locationPhone || '❌ NOT SET');
    console.log('Location Email:', config.locationEmail || '❌ NOT SET');
    console.log('Location Website:', config.locationWebsite || '❌ NOT SET');
    if (config.locationAddress && typeof config.locationAddress === 'object') {
      console.log('Location Address:');
      console.log('  Address:', config.locationAddress.address || '');
      console.log('  City:', config.locationAddress.city || '');
      console.log('  State:', config.locationAddress.state || '');
      console.log('  Postal:', config.locationAddress.postalCode || '');
      console.log('  Country:', config.locationAddress.country || '');
    } else {
      console.log('Location Address:', '❌ NOT SET');
    }
    
    // Company Details
    console.log('\n[Company Details]');
    console.log('Company Name:', config.companyName || '❌ NOT SET');
    
    // OAuth Details
    console.log('\n[OAuth Details]');
    console.log('Scope:', config.scope || '❌ NOT SET');
    console.log('Token Type:', config.tokenType || '❌ NOT SET');
    console.log('Has Encrypted Tokens:', !!config.encryptedTokens);
    
    // Timestamps
    console.log('\n[Timestamps]');
    console.log('Connected At:', config.connectedAt ? new Date(config.connectedAt).toLocaleString() : '❌ NOT SET');
    console.log('Last Token Refresh:', config.lastTokenRefresh ? new Date(config.lastTokenRefresh).toLocaleString() : '❌ NOT SET');
    console.log('Token Expires At:', config.tokenExpiresAt ? new Date(config.tokenExpiresAt).toLocaleString() : '❌ NOT SET');
    
    // Additional Metadata
    console.log('\n[Additional Metadata]');
    console.log('Integration ID:', config.integrationId || '❌ NOT SET');
    console.log('Marketplace App ID:', config.marketplaceAppId || '❌ NOT SET');
    console.log('Permissions:', Array.isArray(config.permissions) ? config.permissions.join(', ') : '❌ NOT SET');
    console.log('User Permissions:', Array.isArray(config.userPermissions) ? config.userPermissions.join(', ') : '❌ NOT SET');
    console.log('Features:', Array.isArray(config.features) ? config.features.join(', ') : '❌ NOT SET');
    
    // Accessible Locations
    if (config.accessibleLocations && Array.isArray(config.accessibleLocations)) {
      console.log('\n[Accessible Locations]');
      console.log(`Total: ${config.accessibleLocations.length}`);
      config.accessibleLocations.slice(0, 5).forEach((loc: any) => {
        console.log(`- ${loc.name} (${loc.id})`);
      });
      if (config.accessibleLocations.length > 5) {
        console.log(`... and ${config.accessibleLocations.length - 5} more`);
      }
    }
    
    // Pipelines
    if (config.pipelines && Array.isArray(config.pipelines)) {
      console.log('\n[Pipelines]');
      console.log(`Total: ${config.pipelines.length}`);
      config.pipelines.forEach((pipeline: any) => {
        console.log(`- ${pipeline.name} (${pipeline.id}) - ${pipeline.stages} stages`);
      });
    }
    
    // Check for any missing critical fields
    console.log('\n⚠️  Missing Critical Fields:');
    const criticalFields = ['locationId', 'companyId', 'locationName', 'userName'];
    const missingFields = criticalFields.filter(field => !config[field]);
    if (missingFields.length > 0) {
      missingFields.forEach(field => console.log(`- ${field}`));
      console.log('\n💡 To populate missing fields, reconnect GoHighLevel or run the fetch-details endpoint');
    } else {
      console.log('✅ All critical fields are populated!');
    }
  }
}

// Run the check
checkGHLFields().catch(console.error);