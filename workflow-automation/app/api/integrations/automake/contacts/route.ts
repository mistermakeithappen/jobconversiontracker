import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, getAuthUser } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    console.log('Contacts endpoint called');
    const supabase = getServiceSupabase();
    console.log('Supabase client created');
    
    const authResult = await getAuthUser(request);
    console.log('Auth result:', authResult);
    if (!authResult || !authResult.userId) {
      console.error('No auth user found in contacts endpoint');
      return NextResponse.json({ 
        contacts: [],
        total: 0,
        message: 'Authentication required'
      }, { status: 401 });
    }
    
    const userId = authResult.userId;
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ 
        contacts: [],
        total: 0,
        message: 'No organization found'
      });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const startAfterId = searchParams.get('startAfterId') || undefined;
    const query = searchParams.get('query') || undefined;
    
    // Get organization's GHL integration
    let { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // If no locationId, return empty data instead of error
    if (!integration.config?.locationId) {
      console.log('No locationId found - returning empty data');
      return NextResponse.json({ 
        contacts: [],
        total: 0,
        limit,
        message: 'Please complete GoHighLevel setup to view contacts'
      });
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
        locationId: integration.config?.locationId,
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
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized') || 
          apiError.message?.includes('invalid_grant') || apiError.message?.includes('Token refresh failed')) {
        // Return empty data with a message instead of error for invalid tokens
        return NextResponse.json({ 
          contacts: [],
          total: 0,
          message: 'GoHighLevel authentication expired. Please reconnect your account.',
          requiresReconnect: true
        });
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