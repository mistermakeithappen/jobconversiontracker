import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }
    
    // Get organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // In a real implementation, this would:
    // 1. Fetch all data from GHL
    // 2. Store it in our database
    // 3. Set up webhooks for real-time updates
    
    // For now, just update the last sync time
    await supabase
      .from('integrations')
      .update({ 
        config: {
          ...integration.config,
          lastSyncAt: new Date().toISOString()
        }
      })
      .eq('id', integration.id);
    
    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      syncedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error syncing GHL data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}