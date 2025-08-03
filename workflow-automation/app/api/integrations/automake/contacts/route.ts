import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const startAfterId = searchParams.get('startAfterId') || undefined;
    const query = searchParams.get('query') || undefined;
    
    // Get organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // Create GHL client with token refresh callback
    const ghlClient = await createGHLClient(
      integration.config?.encryptedTokens || '',
      async (newTokens) => {
        // Update tokens in database when refreshed
        const encryptedTokens = encrypt(JSON.stringify(newTokens));
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              encryptedTokens,
              lastTokenRefresh: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
      }
    );
    
    try {
      // Fetch contacts from GHL API
      const response = await ghlClient.getContacts({
        limit,
        startAfterId,
        query
      });
      
      // Transform GHL contact data to our format
      const contacts = (response.contacts || []).map((contact: any) => ({
        id: contact.id,
        name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
        email: contact.email || '',
        phone: contact.phone || '',
        tags: contact.tags || [],
        dateAdded: contact.dateAdded || contact.createdAt,
        customFields: contact.customFields || {},
        source: contact.source || 'Unknown'
      }));
      
      return NextResponse.json({ 
        contacts,
        total: response.total || contacts.length,
        limit,
        startAfterId: response.meta?.startAfterId
      });
      
    } catch (apiError: any) {
      console.error('GHL API error:', apiError);
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Authentication failed. Please reconnect GoHighLevel.' }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: apiError.message || 'Failed to fetch contacts' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}