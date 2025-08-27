import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;
    const supabase = getServiceSupabase();
    
    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        *,
        property_contacts(
          contact_id,
          relationship_type,
          is_primary,
          contacts(
            id,
            full_name,
            email,
            phone
          )
        ),
        tax_rates(
          tax_rate,
          tax_description
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .single();
    
    if (error) {
      console.error('Error fetching property:', error);
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    
    return NextResponse.json({ property });
    
  } catch (error) {
    console.error('Error in property GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;
    const supabase = getServiceSupabase();
    
    const body = await request.json();
    
    // Remove fields that shouldn't be updated directly
    const { id, organization_id, created_at, created_by, ...updateData } = body;
    
    const { data: property, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating property:', error);
      return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
    
    return NextResponse.json({ property });
    
  } catch (error) {
    console.error('Error in property PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;
    const supabase = getServiceSupabase();
    
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('properties')
      .update({ is_active: false })
      .eq('id', params.id)
      .eq('organization_id', organizationId);
    
    if (error) {
      console.error('Error deleting property:', error);
      return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in property DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}