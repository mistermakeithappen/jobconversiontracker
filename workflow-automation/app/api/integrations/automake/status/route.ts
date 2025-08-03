import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    let userId, user;
    try {
      const authResult = await requireAuth(request);
      userId = authResult.userId;
      user = authResult.user;
    } catch (authError: any) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: authError.message || 'Authentication required' },
        { status: 401 }
      );
    }
    
    const organization = await getUserOrganization(userId);
    
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Check if organization has GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking GHL status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Check if integration needs reconnection
    const needsReconnection = integration?.config?.needsReconnection || false;
    const reconnectionReason = integration?.config?.reconnectionReason || null;
    
    return NextResponse.json({
      connected: !!integration && integration.is_active && !needsReconnection,
      needsReconnection,
      reconnectionReason,
      integrationId: integration?.id || null,
      integration: integration || null
    });
    
  } catch (error) {
    console.error('Error in GHL status check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}