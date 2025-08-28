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
    
    // Get organization details
    const { data: orgData, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      );
    }

    return NextResponse.json(orgData);
  } catch (error) {
    console.error('Error in organization fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;

    const supabase = getServiceSupabase();
    const data = await request.json();

    // Update organization details
    const { data: updatedOrg, error } = await supabase
      .from('organizations')
      .update({
        company_name: data.company_name,
        company_address: data.company_address,
        company_phone: data.company_phone,
        company_email: data.company_email,
        company_logo_url: data.company_logo_url
      })
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: updatedOrg
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationId = organization.organizationId;

    const supabase = getServiceSupabase();
    const data = await request.json();

    // Build update object with only provided fields
    const updateData: any = {};
    
    // Handle estimate settings
    if (data.estimate_settings) {
      updateData.estimate_settings = data.estimate_settings;
    }
    
    if (data.invoice_settings) {
      updateData.invoice_settings = data.invoice_settings;
    }
    
    // Handle other fields if provided
    if (data.company_name !== undefined) updateData.company_name = data.company_name;
    if (data.company_address !== undefined) updateData.company_address = data.company_address;
    if (data.company_phone !== undefined) updateData.company_phone = data.company_phone;
    if (data.company_email !== undefined) updateData.company_email = data.company_email;
    if (data.company_logo_url !== undefined) updateData.company_logo_url = data.company_logo_url;

    // Update organization details
    const { data: updatedOrg, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: updatedOrg
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}