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
    
    // Trigger opportunities sync which will handle commission assignments
    console.log('Starting GHL sync for organization:', organization.organizationId);
    
    try {
      // Call the opportunities endpoint without fromCache to fetch fresh data from GHL
      // This will automatically handle commission assignments for assigned users
      const opportunitiesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/automake/opportunities`, {
        headers: {
          'Cookie': request.headers.get('cookie') || '',
          'Authorization': request.headers.get('authorization') || ''
        }
      });
      
      if (!opportunitiesResponse.ok) {
        const errorData = await opportunitiesResponse.json();
        console.error('Failed to sync opportunities:', errorData);
        return NextResponse.json({ 
          error: 'Failed to sync opportunities', 
          details: errorData.error 
        }, { status: 500 });
      }
      
      const opportunitiesData = await opportunitiesResponse.json();
      console.log(`Synced ${opportunitiesData.opportunities?.length || 0} opportunities`);
      
      // Also sync contacts if we have the scope
      if (integration.config?.scope?.includes('contacts.readonly')) {
        try {
          const contactsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sync/contacts`, {
            method: 'POST',
            headers: {
              'Cookie': request.headers.get('cookie') || '',
              'Authorization': request.headers.get('authorization') || ''
            }
          });
          
          if (contactsResponse.ok) {
            const contactsData = await contactsResponse.json();
            console.log(`Synced ${contactsData.synced || 0} contacts`);
          }
        } catch (contactError) {
          console.error('Error syncing contacts:', contactError);
          // Don't fail the whole sync if contacts fail
        }
      }
      
      // Update the last sync time
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
        syncedAt: new Date().toISOString(),
        opportunities: opportunitiesData.opportunities?.length || 0,
        commissionAssignments: opportunitiesData.commissionAssignments || 'auto-assigned based on opportunity assignments'
      });
      
    } catch (syncError) {
      console.error('Error during sync process:', syncError);
      return NextResponse.json({ 
        error: 'Sync process failed', 
        details: syncError.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error syncing GHL data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}