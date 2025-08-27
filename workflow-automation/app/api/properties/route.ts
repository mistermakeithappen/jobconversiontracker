import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;
    const supabase = getServiceSupabase();
    
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const search = searchParams.get('search');
    
    let query = supabase
      .from('properties')
      .select(`
        *,
        property_contacts!inner(
          contact_id,
          relationship_type,
          is_primary,
          contacts(
            id,
            full_name,
            email,
            phone
          )
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    
    // Filter by contact if provided
    if (contactId) {
      query = query.eq('property_contacts.contact_id', contactId);
    }
    
    // Search by address or nickname
    if (search) {
      query = query.or(`nickname.ilike.%${search}%,full_address.ilike.%${search}%`);
    }
    
    const { data: properties, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
    
    return NextResponse.json({ properties: properties || [] });
    
  } catch (error) {
    console.error('Error in properties GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;
    const supabase = getServiceSupabase();
    
    const body = await request.json();
    const {
      nickname,
      property_type,
      address1,
      address2,
      city,
      state,
      postal_code,
      country,
      tax_exempt,
      tax_exempt_reason,
      custom_tax_rate,
      square_footage,
      lot_size,
      year_built,
      bedrooms,
      bathrooms,
      notes,
      contact_id,
      relationship_type
    } = body;
    
    // Start a transaction
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert({
        organization_id: organizationId,
        nickname,
        property_type: property_type || 'residential',
        address1,
        address2,
        city,
        state,
        postal_code,
        country: country || 'USA',
        tax_exempt: tax_exempt || false,
        tax_exempt_reason,
        custom_tax_rate,
        square_footage,
        lot_size,
        year_built,
        bedrooms,
        bathrooms,
        notes,
        created_by: userId
      })
      .select()
      .single();
    
    if (propertyError) {
      console.error('Error creating property:', propertyError);
      return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
    
    // If contact_id is provided, create the relationship
    if (contact_id && property) {
      const { error: relationError } = await supabase
        .from('property_contacts')
        .insert({
          property_id: property.id,
          contact_id,
          relationship_type: relationship_type || 'owner',
          is_primary: true
        });
      
      if (relationError) {
        console.error('Error creating property-contact relationship:', relationError);
        // Don't fail the whole operation, just log the error
      }
    }
    
    // Try to find and link tax rate
    if (property && postal_code && !custom_tax_rate && !tax_exempt) {
      const { data: taxRate } = await supabase
        .from('tax_rates')
        .select('id')
        .eq('postal_code', postal_code)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();
      
      if (taxRate) {
        await supabase
          .from('properties')
          .update({ tax_rate_id: taxRate.id })
          .eq('id', property.id);
      }
    }
    
    return NextResponse.json({ property });
    
  } catch (error) {
    console.error('Error in properties POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}