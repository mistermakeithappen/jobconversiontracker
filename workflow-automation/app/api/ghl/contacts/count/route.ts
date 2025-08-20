import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Get organization's GHL integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      return NextResponse.json(
        { error: 'No active GoHighLevel integration found' },
        { status: 404 }
      );
    }

    // Get count of active contacts
    const { count, error: countError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('integration_id', integration.id)
      .eq('sync_status', 'synced');

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json(
        { error: 'Failed to count contacts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      count: count || 0,
      locationId: integration.config?.locationId
    });

  } catch (error) {
    console.error('Count error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}