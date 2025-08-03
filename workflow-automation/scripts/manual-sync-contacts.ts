import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { GHLClient } from '../lib/integrations/gohighlevel/client';
import { decrypt } from '../lib/utils/encryption';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function manualSync() {
  console.log('🚀 Starting manual contact sync...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const userId = 'af8ba507-b380-4da8-a1e2-23adee7497d5'; // Mock user

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

  console.log('✅ Found integration');
  console.log('   Location ID:', integration.config?.locationId);

  try {
    // Decrypt tokens from config.encryptedTokens
    if (!integration.config?.encryptedTokens) {
      console.error('❌ No encrypted tokens found in integration');
      return;
    }

    const decryptedTokens = decrypt(integration.config.encryptedTokens);
    console.log('✅ Tokens decrypted');
    console.log('   Decrypted data type:', typeof decryptedTokens);
    console.log('   Decrypted keys:', decryptedTokens ? Object.keys(JSON.parse(decryptedTokens)) : 'N/A');
    
    const tokens = JSON.parse(decryptedTokens);
    const accessToken = tokens.accessToken || tokens.access_token;
    const refreshToken = tokens.refreshToken || tokens.refresh_token;
    const expiresAt = tokens.expiresAt || tokens.expires_at || integration.expires_at;

    console.log('   Access token exists:', !!accessToken);
    console.log('   Refresh token exists:', !!refreshToken);
    console.log('   Expires at:', expiresAt);

    // Create GHL client
    const client = new GHLClient({
      accessToken,
      refreshToken,
      expiresAt: expiresAt || Date.now() + (24 * 60 * 60 * 1000), // Default to 24 hours if not set
      locationId: integration.config.locationId,
      companyId: integration.config.companyId,
      userId: integration.config.userId
    });

    console.log('✅ GHL client created');

    // Test fetching contacts
    console.log('\n📦 Fetching first batch of contacts...');
    const response = await client.getContacts({ limit: 10 });
    
    console.log('Response type:', typeof response);
    console.log('Response is array:', Array.isArray(response));
    
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      console.log('Response keys:', Object.keys(response));
      console.log('Response preview:', JSON.stringify(response, null, 2).substring(0, 500));
    }
    
    const contacts = Array.isArray(response) ? response : response?.contacts || response?.data || [];

    if (!contacts || !Array.isArray(contacts)) {
      console.error('❌ No contacts array found in response');
      return;
    }

    console.log(`✅ Got ${contacts.length} contacts`);

    // Show first few contacts
    contacts.slice(0, 3).forEach((contact: any) => {
      const name = contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.phone || 'Unknown';
      console.log(`   - ${name} | ${contact.email || 'no email'} | ${contact.phone || 'no phone'}`);
    });

    // Check if Brandon is in this batch
    const brandon = contacts.find((c: any) => {
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const contactName = (c.contactName || '').toLowerCase();
      return fullName.includes('brandon') || contactName.includes('brandon');
    });

    if (brandon) {
      console.log('\n✅ Found Brandon in first batch!');
      console.log(JSON.stringify(brandon, null, 2));
    } else {
      console.log('\n⚠️ Brandon not in first 10 contacts. Would need to paginate through all 5000.');
    }

    // Save first batch to database
    console.log('\n💾 Saving contacts to database...');
    
    for (const contact of contacts) {
      const contactData = {
        user_id: userId,
        location_id: integration.config.locationId,
        contact_id: contact.id,
        first_name: contact.firstName || contact.firstNameRaw,
        last_name: contact.lastName || contact.lastNameRaw,
        contact_name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        phone: contact.phone,
        company_name: contact.companyName,
        address1: contact.address1,
        city: contact.city,
        state: contact.state,
        postal_code: contact.postalCode,
        country: contact.country,
        timezone: contact.timezone,
        website: contact.website,
        type: contact.type,
        source: contact.source,
        assigned_to: contact.assignedTo,
        dnd: contact.dnd || false,
        business_id: contact.businessId,
        date_of_birth: contact.dateOfBirth,
        date_added: contact.dateAdded,
        date_updated: contact.dateUpdated,
        tags: contact.tags || [],
        custom_fields: contact.customFields || [],
        additional_emails: contact.additionalEmails || [],
        attributions: contact.attributions || [],
        dnd_settings: contact.dndSettings || {},
        followers: contact.followers || [],
        social_profiles: contact.social || {},
        sync_status: 'active'
      };

      const { error } = await supabase
        .from('ghl_contacts')
        .upsert(contactData, {
          onConflict: 'location_id,contact_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Error saving contact ${contact.id}:`, error);
      }
    }

    console.log(`✅ Saved ${contacts.length} contacts to database`);

    // Check database
    const { count } = await supabase
      .from('ghl_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', integration.config.locationId);

    console.log(`\n📊 Total contacts in database: ${count}`);

  } catch (error) {
    console.error('❌ Sync error:', error);
  }
}

manualSync().catch(console.error);