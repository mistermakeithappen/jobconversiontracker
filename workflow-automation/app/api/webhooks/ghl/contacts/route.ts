import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { headers } from 'next/headers';
import crypto from 'crypto';

// GoHighLevel webhook events for contacts
type ContactEvent = 'contact.create' | 'contact.update' | 'contact.delete';

interface GHLContactWebhook {
  type: ContactEvent;
  locationId: string;
  id: string; // Event ID
  contactId: string;
  contact?: any; // Full contact data for create/update
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    console.log('📨 GHL Contact Webhook received:', {
      type: body.type,
      locationId: body.locationId,
      contactId: body.contactId
    });

    // Verify webhook signature if provided
    const signature = headers().get('x-ghl-signature');
    if (signature && process.env.GHL_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.GHL_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Find the user associated with this location
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('user_id')
      .eq('type', 'gohighlevel')
      .eq('config->locationId', body.locationId)
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      console.error('❌ No active integration found for location:', body.locationId);
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const userId = integration.user_id;

    // Handle different event types
    switch (body.type) {
      case 'contact.create':
      case 'contact.update':
        await upsertContact(supabase, userId, body.locationId, body.contact);
        break;
        
      case 'contact.delete':
        await deleteContact(supabase, userId, body.locationId, body.contactId);
        break;
        
      default:
        console.log('⚠️ Unknown event type:', body.type);
    }

    // Log the sync operation
    await supabase.from('ghl_contact_sync_logs').insert({
      user_id: userId,
      location_id: body.locationId,
      sync_type: 'webhook',
      status: 'completed',
      contacts_processed: 1,
      contacts_created: body.type === 'contact.create' ? 1 : 0,
      contacts_updated: body.type === 'contact.update' ? 1 : 0,
      contacts_deleted: body.type === 'contact.delete' ? 1 : 0,
      completed_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function upsertContact(
  supabase: any,
  userId: string,
  locationId: string,
  contact: any
) {
  try {
    const contactData = {
      user_id: userId,
      location_id: locationId,
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
      sync_status: 'active',
      sync_error: null
    };

    const { error } = await supabase
      .from('ghl_contacts')
      .upsert(contactData, {
        onConflict: 'location_id,contact_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Error upserting contact:', error);
      throw error;
    }

    console.log('✅ Contact upserted:', contact.id);
  } catch (error) {
    console.error('❌ Failed to upsert contact:', error);
    throw error;
  }
}

async function deleteContact(
  supabase: any,
  userId: string,
  locationId: string,
  contactId: string
) {
  try {
    // Soft delete - mark as deleted but keep the record
    const { error } = await supabase
      .from('ghl_contacts')
      .update({ 
        sync_status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('location_id', locationId)
      .eq('contact_id', contactId);

    if (error) {
      console.error('❌ Error deleting contact:', error);
      throw error;
    }

    console.log('✅ Contact marked as deleted:', contactId);
  } catch (error) {
    console.error('❌ Failed to delete contact:', error);
    throw error;
  }
}