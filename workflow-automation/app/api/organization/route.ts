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