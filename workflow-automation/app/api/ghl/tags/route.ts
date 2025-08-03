import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Get organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    if (error || !integration) {
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found', 
        details: 'Please connect your GoHighLevel account in settings',
        tags: [] 
      }, { status: 200 });
    }
    
    // Check if we have encrypted tokens
    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ 
        error: 'GoHighLevel tokens not found', 
        details: 'Please reconnect your GoHighLevel account',
        tags: [] 
      }, { status: 200 });
    }
    
    // Get MCP integration if available
    let mcpApiKey: string | undefined;
    const { data: mcpIntegration } = await supabase
      .from('mcp_integrations')
      .select('private_integration_token')
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();
    
    if (mcpIntegration?.private_integration_token) {
      mcpApiKey = mcpIntegration.private_integration_token;
    }
    
    // Create GHL client
    const client = await createGHLClient(
      integration.config.encryptedTokens,
      undefined,
      mcpApiKey
    );
    
    // Get location ID from config
    const locationId = integration.config.locationId || client.getLocationId();
    
    console.log('Fetching tags for location:', locationId);
    
    try {
      // Try to get tags via v2 API - tags are often part of location settings
      const response = await client.makeRequest(`/locations/${locationId}/tags`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      
      console.log('Tags v2 API response:', response);
      
      let tags: string[] = [];
      
      if (response?.tags && Array.isArray(response.tags)) {
        tags = response.tags;
      } else if (Array.isArray(response)) {
        tags = response;
      } else if (response?.data && Array.isArray(response.data)) {
        tags = response.data;
      }
      
      return NextResponse.json({ 
        tags: tags.sort(),
        locationId,
        success: true 
      });
      
    } catch (error: any) {
      console.log('V2 tags endpoint failed, extracting from contacts...');
      
      // Fallback: Fetch contacts to extract unique tags
      const contacts = await client.getContacts({ limit: 100 });
      
      const tagSet = new Set<string>();
      if (contacts?.contacts) {
        contacts.contacts.forEach((contact: any) => {
          if (contact.tags && Array.isArray(contact.tags)) {
            contact.tags.forEach((tag: string) => tagSet.add(tag));
          }
        });
      }
      
      const tags = Array.from(tagSet).sort();
      
      return NextResponse.json({ 
        tags,
        locationId,
        success: true,
        source: 'contacts' 
      });
    }
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tags',
        tags: []
      },
      { status: 200 }
    );
  }
}