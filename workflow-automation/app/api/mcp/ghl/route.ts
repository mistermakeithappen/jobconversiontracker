import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { encrypt, decrypt } from '@/lib/utils/encryption';

// GET: Check MCP status and capabilities
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
      
    if (!membership) {
      return NextResponse.json({ 
        connected: false,
        error: 'No organization found for user' 
      });
    }
    
    // Get organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ 
        connected: false,
        error: 'GoHighLevel integration not found' 
      });
    }

    // Check if MCP is enabled
    if (!integration.mcp_enabled) {
      return NextResponse.json({ 
        connected: false,
        mcpEnabled: false,
        hasStoredToken: false,
        capabilities: null
      });
    }

    // Get MCP token - check if it's stored as API key reference or directly
    let mcpToken;
    if (integration.mcp_token_encrypted) {
      try {
        // Try to parse as JSON (new format with API key reference)
        const tokenData = JSON.parse(integration.mcp_token_encrypted);
        
        if (tokenData.type === 'user_api_keys_reference' && tokenData.api_key_id) {
          // Get token from user_api_keys table
          const { data: apiKey, error: keyError } = await supabase
            .from('user_api_keys')
            .select('encrypted_key')
            .eq('id', tokenData.api_key_id)
            .eq('is_active', true)
            .single();
            
          if (keyError || !apiKey) {
            return NextResponse.json({ 
              connected: false,
              mcpEnabled: true,
              hasStoredToken: true,
              error: 'MCP API key not found or inactive'
            });
          }
          
          mcpToken = decrypt(apiKey.encrypted_key);
        } else {
          return NextResponse.json({ 
            connected: false,
            mcpEnabled: true,
            hasStoredToken: true,
            error: 'Invalid MCP token format'
          });
        }
      } catch (parseError) {
        // Not JSON, assume it's the old direct encrypted token format
        mcpToken = decrypt(integration.mcp_token_encrypted);
      }
    } else {
      return NextResponse.json({ 
        connected: false,
        mcpEnabled: true,
        hasStoredToken: false,
        error: 'No MCP token found'
      });
    }

    // Try to connect and get capabilities
    try {
      const client = await createGHLMCPClient({
        mcpToken,
        locationId: integration.config.locationId
      });

      if (!client) {
        return NextResponse.json({ 
          connected: false,
          mcpEnabled: true,
          hasStoredToken: true,
          error: 'Failed to create MCP client'
        });
      }

      // Get available tools, resources, and prompts
      const [tools, resources, prompts] = await Promise.all([
        client.listTools().catch(() => ({ tools: [] })),
        client.listResources().catch(() => ({ resources: [] })),
        client.listPrompts().catch(() => ({ prompts: [] }))
      ]);

      const capabilities = {
        tools: tools.tools || [],
        resources: resources.resources || [],
        prompts: prompts.prompts || [],
        lastUpdated: new Date().toISOString()
      };

      // Update cached capabilities
      await supabase
        .from('integrations')
        .update({
          mcp_capabilities: capabilities,
          mcp_last_connected_at: new Date().toISOString()
        })
        .eq('id', integration.id);

      await client.disconnect();

      return NextResponse.json({
        connected: true,
        mcpEnabled: true,
        hasStoredToken: true,
        capabilities,
        lastConnected: integration.mcp_last_connected_at
      });

    } catch (mcpError) {
      console.error('MCP connection error:', mcpError);
      return NextResponse.json({
        connected: false,
        mcpEnabled: true,
        hasStoredToken: true,
        error: 'Failed to connect to MCP server',
        details: mcpError instanceof Error ? mcpError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error checking MCP status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST: Enable/configure MCP
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 MCP POST request started');
    
    const { userId } = await requireAuth(request);
    console.log('✅ Auth successful, userId:', userId);
    
    const supabase = getServiceSupabase();
    const { mcpToken, endpoint } = await request.json();
    console.log('✅ Request parsed, token length:', mcpToken?.length || 0);

    if (!mcpToken) {
      console.log('❌ No MCP token provided');
      return NextResponse.json({ 
        error: 'MCP token is required' 
      }, { status: 400 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
      
    if (!membership) {
      return NextResponse.json({ 
        error: 'No organization found for user' 
      }, { status: 404 });
    }
    
    // Get organization's GHL integration
    console.log('🔍 Looking for GHL integration for organization:', membership.organization_id);
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error) {
      console.log('❌ Integration query error:', error);
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found',
        details: error.message
      }, { status: 404 });
    }
    
    if (!integration) {
      console.log('❌ No integration found');
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found' 
      }, { status: 404 });
    }
    
    console.log('✅ Found integration:', integration.id);

    // Basic token format validation for GHL PIT tokens
    console.log('🔍 Validating token format:', mcpToken.substring(0, 10) + '...');
    if (!mcpToken.match(/^pit-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
      console.log('❌ Token format validation failed');
      return NextResponse.json({ 
        error: 'Invalid Private Integration Token format. Expected format: pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        details: 'GoHighLevel Private Integration Tokens must start with "pit-" followed by a UUID'
      }, { status: 400 });
    }
    console.log('✅ Token format valid');

    // Note: We'll validate the actual connection when MCP is first used
    // This allows users to save tokens even if GHL MCP server is temporarily unavailable

    // Save the PIT token to user_api_keys table
    console.log('🔐 Encrypting token...');
    const encryptedToken = encrypt(mcpToken);
    console.log('✅ Token encrypted');
    
    // First, check if there's already a GHL MCP token for this organization (active or inactive)
    console.log('🔍 Checking for existing GHL MCP token...');
    const { data: existingKey, error: existingKeyError } = await supabase
      .from('user_api_keys')
      .select('id, is_active')
      .eq('organization_id', membership.organization_id)
      .eq('service', 'ghlmcp')
      .single();
      
    if (existingKeyError && existingKeyError.code !== 'PGRST116') {
      console.log('❌ Error checking for existing key:', existingKeyError);
    } else {
      console.log('✅ Existing key check complete:', existingKey ? 'Found existing' : 'No existing key');
    }
    
    let apiKeyId;
    
    if (existingKey) {
      // Update existing key - overwrite the previous token and reactivate if needed
      console.log('🔄 Updating existing key:', existingKey.id, '(active:', existingKey.is_active, ')');
      const { data: updatedKey, error: updateKeyError } = await supabase
        .from('user_api_keys')
        .update({
          encrypted_key: encryptedToken,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingKey.id)
        .select('id')
        .single();
        
      if (updateKeyError) {
        console.error('❌ Error updating API key:', updateKeyError);
        return NextResponse.json({ 
          error: 'Failed to update MCP token',
          details: updateKeyError.message || 'Database update error'
        }, { status: 500 });
      }
      
      apiKeyId = updatedKey.id;
      console.log(`✅ Updated existing MCP token for user ${userId}, API key ID: ${apiKeyId}`);
    } else {
      // Create new key
      console.log('➕ Creating new key for organization:', membership.organization_id);
      const { data: newKey, error: insertKeyError } = await supabase
        .from('user_api_keys')
        .insert({
          organization_id: membership.organization_id,
          service: 'ghlmcp',
          encrypted_key: encryptedToken,
          is_active: true,
          created_by: userId
        })
        .select('id')
        .single();
        
      if (insertKeyError) {
        console.error('❌ Error creating API key:', insertKeyError);
        console.error('Insert details:', {
          organization_id: membership.organization_id,
          service: 'ghlmcp',
          encrypted_key_length: encryptedToken.length,
          created_by: userId
        });
        return NextResponse.json({ 
          error: 'Failed to save MCP token',
          details: insertKeyError.message || 'Database insert error'
        }, { status: 500 });
      }
      
      apiKeyId = newKey.id;
      console.log(`✅ Created new MCP token for user ${userId}, API key ID: ${apiKeyId}`);
    }
    
    // Update integration to enable MCP and store API key reference
    // Note: Storing API key ID in mcp_token_encrypted as JSON until mcp_api_key_id column is added
    console.log('🔄 Updating integration with MCP config...');
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        mcp_enabled: true,
        mcp_token_encrypted: JSON.stringify({ api_key_id: apiKeyId, type: 'user_api_keys_reference' }),
        mcp_endpoint: endpoint || 'https://services.leadconnectorhq.com/mcp/',
        mcp_last_connected_at: new Date().toISOString()
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('❌ Error updating integration:', updateError);
      return NextResponse.json({ 
        error: 'Failed to save MCP configuration',
        details: updateError.message || 'Integration update error'
      }, { status: 500 });
    }
    
    console.log('✅ Integration updated successfully');

    const actionType = existingKey ? 'updated' : 'saved';
    return NextResponse.json({
      success: true,
      message: `MCP token ${actionType} and enabled successfully`
    });

  } catch (error) {
    console.error('Error enabling MCP:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE: Disable MCP
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
      
    if (!membership) {
      return NextResponse.json({ 
        error: 'No organization found for user' 
      }, { status: 404 });
    }

    // Get organization's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found' 
      }, { status: 404 });
    }

    // Get the current integration details to find API key ID
    const { data: currentIntegration } = await supabase
      .from('integrations')
      .select('mcp_token_encrypted')
      .eq('id', integration.id)
      .single();
    
    // Disable the API key if it exists in user_api_keys table
    if (currentIntegration?.mcp_token_encrypted) {
      try {
        const tokenData = JSON.parse(currentIntegration.mcp_token_encrypted);
        if (tokenData.type === 'user_api_keys_reference' && tokenData.api_key_id) {
          await supabase
            .from('user_api_keys')
            .update({ is_active: false })
            .eq('id', tokenData.api_key_id);
        }
      } catch (parseError) {
        // Old format, no API key to disable
      }
    }
    
    // Disable MCP on integration
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        mcp_enabled: false,
        mcp_token_encrypted: null,
        mcp_capabilities: {}
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('Error disabling MCP:', updateError);
      return NextResponse.json({ 
        error: 'Failed to disable MCP' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'MCP disabled successfully'
    });

  } catch (error) {
    console.error('Error disabling MCP:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}