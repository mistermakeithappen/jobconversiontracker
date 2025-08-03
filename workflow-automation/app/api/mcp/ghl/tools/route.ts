import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { decrypt } from '@/lib/utils/encryption';

// POST: Call an MCP tool
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { tool, arguments: toolArgs } = await request.json();

    if (!tool) {
      return NextResponse.json({ 
        error: 'Tool name is required' 
      }, { status: 400 });
    }

    // Get user's GHL integration with MCP config
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .eq('mcp_enabled', true)
      .single();

    if (error || !integration || !integration.mcp_token_encrypted) {
      return NextResponse.json({ 
        error: 'MCP not enabled for this integration' 
      }, { status: 404 });
    }

    // Create MCP client
    const mcpToken = decrypt(integration.mcp_token_encrypted);
    const client = await createGHLMCPClient({
      mcpToken,
      locationId: integration.config.locationId
    });

    if (!client) {
      return NextResponse.json({ 
        error: 'Failed to create MCP client' 
      }, { status: 500 });
    }

    try {
      // Call the tool
      let result;
      
      // Use the helper methods for common operations
      switch (tool) {
        case 'ghl_get_contacts':
          result = await client.getContacts(toolArgs);
          break;
        case 'ghl_get_contact':
          result = await client.getContact(toolArgs.contactId);
          break;
        case 'ghl_create_contact':
          result = await client.createContact(toolArgs);
          break;
        case 'ghl_update_contact':
          result = await client.updateContact(toolArgs.contactId, toolArgs);
          break;
        case 'ghl_get_opportunities':
          result = await client.getOpportunities(toolArgs);
          break;
        case 'ghl_get_opportunity':
          result = await client.getOpportunity(toolArgs.opportunityId);
          break;
        case 'ghl_update_opportunity':
          result = await client.updateOpportunity(toolArgs.opportunityId, toolArgs);
          break;
        case 'ghl_get_pipelines':
          result = await client.getPipelines();
          break;
        case 'ghl_get_users':
          result = await client.getUsers();
          break;
        case 'ghl_send_sms':
          result = await client.sendSMS(toolArgs.to, toolArgs.message);
          break;
        case 'ghl_send_email':
          result = await client.sendEmail(toolArgs);
          break;
        case 'ghl_create_note':
          result = await client.createNote(toolArgs.contactId, toolArgs.body);
          break;
        case 'ghl_create_task':
          result = await client.createTask(toolArgs);
          break;
        case 'ghl_get_workflows':
          result = await client.getWorkflows();
          break;
        case 'ghl_trigger_workflow':
          result = await client.triggerWorkflow(toolArgs.workflowId, toolArgs.contactId);
          break;
        default:
          // For any other tools, call directly
          result = await client.callTool(tool, toolArgs || {});
      }

      await client.disconnect();

      return NextResponse.json({
        success: true,
        result
      });

    } catch (toolError) {
      await client.disconnect();
      console.error('MCP tool error:', toolError);
      return NextResponse.json({
        error: 'Tool execution failed',
        details: toolError instanceof Error ? toolError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error calling MCP tool:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}