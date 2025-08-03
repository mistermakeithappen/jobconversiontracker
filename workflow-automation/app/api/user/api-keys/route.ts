import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    console.log('API Keys GET request received');
    
    const { userId } = await requireAuth(request);
    console.log('Authenticated user:', userId);
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    console.log('Fetching API keys for organization:', organization.organizationId);
    const apiKeys = await ApiKeyManager.listUserApiKeys(organization.organizationId);
    
    // Return masked keys for security
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      provider: key.service, // Map service to provider for frontend compatibility
      maskedKey: ApiKeyManager.maskApiKey('sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') // Placeholder mask
    }));

    // Check if there's a GHL PIT token
    try {
      const mcpResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/ghl`, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });

      if (mcpResponse.ok) {
        const mcpData = await mcpResponse.json();
        if (mcpData.hasStoredToken) {
          // Add a virtual GHL PIT entry
          maskedKeys.push({
            id: 'ghl-pit-stored',
            provider: 'ghlpit',
            service: 'ghlpit',
            keyName: 'GoHighLevel Private Integration Token',
            maskedKey: 'pit-••••••••-••••-••••-••••-••••••••••••',
            createdAt: new Date().toISOString(),
            isActive: true
          });
        }
      }
    } catch (error) {
      console.error('Error checking GHL PIT status:', error);
    }

    console.log('Returning masked keys:', maskedKeys.length);
    return NextResponse.json({ apiKeys: maskedKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const body = await request.json();
    console.log('API Keys POST body:', body);
    const { provider, apiKey, keyName } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    console.log('Storing API key with provider:', provider, 'for organization:', organization.organizationId);
    
    // Handle GoHighLevel PIT separately - it should update the integration
    if (provider === 'ghlpit') {
      // First check if the MCP columns exist
      try {
        // Use the MCP endpoint to save the PIT
        const { getServiceSupabase } = await import('@/lib/supabase/client');
        const supabase = getServiceSupabase();
        
        // Get the user's organization's GHL integration
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('*')
          .eq('organization_id', organization.organizationId)
          .eq('type', 'gohighlevel')
          .eq('is_active', true)
          .single();
          
        if (integrationError || !integration) {
          throw new Error('GoHighLevel integration not found. Please connect GoHighLevel first.');
        }
        
        // Check if MCP columns exist by trying to select them
        const { error: columnCheckError } = await supabase
          .from('integrations')
          .select('mcp_enabled')
          .eq('id', integration.id)
          .single();
          
        if (columnCheckError && columnCheckError.message.includes('mcp_enabled')) {
          // MCP columns don't exist yet
          throw new Error('Database migration required. Please run the MCP columns migration in your Supabase dashboard.');
        }
        
        // Now try to save via MCP endpoint
        const mcpResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/ghl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({ mcpToken: apiKey })
        });

        if (!mcpResponse.ok) {
          const mcpError = await mcpResponse.json();
          throw new Error(mcpError.error || 'Failed to save GoHighLevel Private Integration Token');
        }
      } catch (error) {
        console.error('Error saving GHL PIT:', error);
        throw error;
      }

      // Return a mock response that looks like an API key
      return NextResponse.json({ 
        success: true, 
        apiKey: {
          id: 'ghl-pit-' + Date.now(),
          provider: 'ghlpit',
          service: 'ghlpit',
          keyName: keyName || 'GoHighLevel PIT',
          maskedKey: ApiKeyManager.maskApiKey(apiKey),
          createdAt: new Date().toISOString(),
          isActive: true
        }
      });
    }
    
    const storedKey = await ApiKeyManager.storeApiKey({
      organizationId: organization.organizationId,
      service: provider as 'openai' | 'anthropic' | 'google' | 'azure' | 'notion',
      apiKey
    });

    return NextResponse.json({ 
      success: true, 
      apiKey: {
        ...storedKey,
        provider: storedKey.service, // Map service to provider for frontend compatibility
        maskedKey: ApiKeyManager.maskApiKey(apiKey)
      }
    });
  } catch (error) {
    console.error('Error storing API key:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Ensure we always return valid JSON
    const errorMessage = error instanceof Error ? error.message : 'Failed to store API key';
    
    // Check for specific error cases
    if (errorMessage.includes('Database migration required')) {
      return NextResponse.json(
        { 
          error: 'Database Update Required',
          details: 'The MCP columns need to be added to your database. Please contact your administrator or run the migration script.'
        },
        { status: 503 }
      );
    } else if (errorMessage.includes('GoHighLevel integration not found')) {
      return NextResponse.json(
        { 
          error: 'GoHighLevel Not Connected',
          details: 'Please connect your GoHighLevel account first before adding a Private Integration Token.'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage, details: String(error) },
      { status: 500 }
    );
  }
}