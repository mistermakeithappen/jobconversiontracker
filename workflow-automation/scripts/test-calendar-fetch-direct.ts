import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '../lib/integrations/gohighlevel/client';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function testCalendarFetchDirect() {
  console.log('🔍 Testing calendar fetch directly...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get user's GHL integration
    console.log('1. Fetching GHL integration for user:', mockUserId);
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config, mcp_token_encrypted')
      .eq('user_id', mockUserId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (error) {
      console.error('Error fetching integration:', error);
      return;
    }
    
    if (!integration?.config?.encryptedTokens) {
      console.error('No GHL integration found');
      return;
    }
    
    console.log('✅ Found integration');
    console.log('   Location ID:', integration.config.locationId || 'NOT SET');
    console.log('   Company ID:', integration.config.companyId || 'NOT SET');
    console.log('   User Type:', integration.config.userType || 'NOT SET');
    
    // Create GHL client
    console.log('\n2. Creating GHL client...');
    const client = await createGHLClient(integration.config.encryptedTokens);
    console.log('✅ Client created');
    console.log('   Client location ID:', client.getLocationId());
    
    // Fetch calendars
    console.log('\n3. Fetching calendars...');
    const locationId = integration.config.locationId || client.getLocationId();
    
    if (!locationId) {
      console.error('❌ No location ID available!');
      console.log('This is the root cause - we need location ID to fetch calendars');
      return;
    }
    
    const queryParams = new URLSearchParams({
      locationId: locationId
    });
    
    console.log('   Using location ID:', locationId);
    console.log('   API URL:', `/calendars?${queryParams}`);
    
    const response = await client.makeRequest(`/calendars?${queryParams}`, {
      method: 'GET'
    });
    
    console.log('\n📅 Calendar Response:', JSON.stringify(response, null, 2));
    
    if (response?.calendars && Array.isArray(response.calendars)) {
      console.log(`\n✅ Found ${response.calendars.length} calendars`);
      
      response.calendars.forEach((cal: any, index: number) => {
        console.log(`\n${index + 1}. ${cal.name} (${cal.id})`);
        console.log(`   Type: ${cal.calendarType || 'N/A'}`);
        console.log(`   Widget Type: ${cal.widgetType || 'N/A'}`);
        console.log(`   Active: ${cal.isActive}`);
      });
    } else {
      console.log('\n❌ No calendars found in response');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the test
testCalendarFetchDirect().catch(console.error);