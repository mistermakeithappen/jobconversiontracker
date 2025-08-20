import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const supabase = getServiceSupabase();
    
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
        customFields: [] 
      }, { status: 200 });
    }
    
    // Check if we have encrypted tokens
    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ 
        error: 'GoHighLevel tokens not found', 
        details: 'Please reconnect your GoHighLevel account',
        customFields: [] 
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
    
    console.log('Fetching custom fields for location:', locationId);
    
    try {
      // Use v2 API endpoint for custom fields
      const response = await client.makeRequest(`/locations/${locationId}/customFields`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      
      console.log('Custom fields v2 API response:', response);
      
      let fields: any[] = [];
      
      // Handle different response formats
      if (response?.customFields && Array.isArray(response.customFields)) {
        fields = response.customFields;
      } else if (Array.isArray(response)) {
        fields = response;
      } else if (response?.data && Array.isArray(response.data)) {
        fields = response.data;
      }
      
      // Process and format the custom fields
      const processedFields = fields.map((field: any) => ({
        id: field.id || field._id,
        name: field.name || field.fieldKey,
        fieldKey: field.fieldKey || field.key,
        dataType: field.dataType || field.type || 'text',
        placeholder: field.placeholder || '',
        position: field.position || 0,
        isRequired: field.isRequired || false,
        isMultiple: field.isMultiple || false,
        options: field.options || [],
        isSystemField: field.isSystemField || false,
        isSearchable: field.isSearchable !== false
      }));
      
      return NextResponse.json({ 
        customFields: processedFields,
        locationId,
        success: true 
      });
      
    } catch (error: any) {
      // If v2 endpoint fails, try the legacy method
      console.log('V2 API failed, trying legacy method...');
      const customFields = await client.getCustomFields(locationId);
      const fields = customFields?.customFields || [];
      return NextResponse.json({ customFields: fields });
    }
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch custom fields',
        customFields: []
      },
      { status: 200 }
    );
  }
}