import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { decrypt } from '@/lib/utils/encryption';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { action, method } = body;

    // Get user's GHL integration and MCP token
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (error || !integration) {
      return NextResponse.json({
        success: false,
        message: 'No active GoHighLevel integration found. Please connect your GHL account first.'
      }, { status: 400 });
    }

    // Check if MCP is enabled and get token
    let mcpToken;
    if (integration.mcp_enabled && integration.mcp_token_encrypted) {
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
              success: false,
              message: 'MCP token not found or inactive. Please check your MCP settings.'
            }, { status: 400 });
          }
          
          mcpToken = decrypt(apiKey.encrypted_key);
        } else {
          return NextResponse.json({
            success: false,
            message: 'Invalid MCP token format. Please reconnect MCP in your settings.'
          }, { status: 400 });
        }
      } catch (parseError) {
        // Not JSON, assume it's the old direct encrypted token format
        mcpToken = decrypt(integration.mcp_token_encrypted);
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'MCP is not enabled. Please enable MCP and provide your Private Integration Token.'
      }, { status: 400 });
    }

    if (action === 'debug_chatbot') {
      const { debug_info } = body;
      return NextResponse.json({
        success: true,
        message: `Chatbot Debug - LocationID: ${debug_info.locationId}, HasToken: ${debug_info.hasMcpToken}, TokenStart: ${debug_info.mcpTokenStart}, TokenLength: ${debug_info.tokenLength}`,
        data: debug_info
      });
    }

    if (action === 'test_connection') {
      try {
        // Create MCP client to test connection
        const client = await createGHLMCPClient({
          mcpToken,
          locationId: integration.config.locationId
        });

        if (!client) {
          return NextResponse.json({
            success: false,
            message: 'Failed to create MCP client connection'
          }, { status: 500 });
        }

        // Test basic connection by trying to initialize
        await client.disconnect();

        return NextResponse.json({
          success: true,
          message: 'MCP connection successful',
          data: {
            endpoint: 'https://services.leadconnectorhq.com/mcp/',
            locationId: integration.config.locationId,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('MCP connection test failed:', error);
        return NextResponse.json({
          success: false,
          message: `MCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error
        }, { status: 500 });
      }
    }

    if (action === 'test_api') {
      try {
        // Create MCP client
        const client = await createGHLMCPClient({
          mcpToken,
          locationId: integration.config.locationId
        });

        if (!client) {
          return NextResponse.json({
            success: false,
            message: 'Failed to create MCP client'
          }, { status: 500 });
        }

        let results;
        let testMethod = method;

        switch (method) {
          // Calendar Tools
          case 'getCalendarEvents':
            try {
              results = await client.getCalendarEvents({ 
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              });
              testMethod = 'Get Calendar Events';
            } catch (error) {
              throw new Error(`getCalendarEvents failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getAppointmentNotes':
            try {
              // This requires an appointmentId - we'll use a placeholder and expect it to fail gracefully
              results = await client.getAppointmentNotes('test-appointment-id');
              testMethod = 'Get Appointment Notes';
            } catch (error) {
              throw new Error(`getAppointmentNotes failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Contact Tools
          case 'getContacts':
            try {
              // Allow custom parameters from request
              const contactParams = body.customParams || { limit: 5 };
              console.log('🔍 Testing getContacts with params:', contactParams);
              results = await client.getContacts(contactParams);
              testMethod = 'Get Contacts';
            } catch (error) {
              throw new Error(`getContacts failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getContact':
            try {
              // First get a contact ID from contacts list
              const contacts = await client.getContacts({ limit: 1 });
              if (contacts && contacts.length > 0) {
                results = await client.getContact(contacts[0].id);
              } else {
                results = { message: 'No contacts found to test with' };
              }
              testMethod = 'Get Single Contact';
            } catch (error) {
              throw new Error(`getContact failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getAllTasks':
            try {
              const contacts = await client.getContacts({ limit: 1 });
              if (contacts && contacts.length > 0) {
                results = await client.getAllTasks(contacts[0].id);
              } else {
                results = { message: 'No contacts found to test tasks with' };
              }
              testMethod = 'Get All Tasks';
            } catch (error) {
              throw new Error(`getAllTasks failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'createContact':
            try {
              results = await client.createContact({
                firstName: 'Test',
                lastName: 'Contact',
                email: `test-${Date.now()}@example.com`,
                phone: '+1234567890'
              });
              testMethod = 'Create Contact';
            } catch (error) {
              throw new Error(`createContact failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'updateContact':
            try {
              const contacts = await client.getContacts({ limit: 1 });
              if (contacts && contacts.length > 0) {
                results = await client.updateContact(contacts[0].id, {
                  firstName: 'Updated Test'
                });
              } else {
                results = { message: 'No contacts found to test update with' };
              }
              testMethod = 'Update Contact';
            } catch (error) {
              throw new Error(`updateContact failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'upsertContact':
            try {
              results = await client.upsertContact({
                email: `upsert-test-${Date.now()}@example.com`,
                firstName: 'Upsert',
                lastName: 'Test'
              });
              testMethod = 'Upsert Contact';
            } catch (error) {
              throw new Error(`upsertContact failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'addTags':
            try {
              const contacts = await client.getContacts({ limit: 1 });
              if (contacts && contacts.length > 0) {
                results = await client.addTags(contacts[0].id, ['test-tag', 'mcp-test']);
              } else {
                results = { message: 'No contacts found to test tag addition with' };
              }
              testMethod = 'Add Tags to Contact';
            } catch (error) {
              throw new Error(`addTags failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'removeTags':
            try {
              const contacts = await client.getContacts({ limit: 1 });
              if (contacts && contacts.length > 0) {
                results = await client.removeTags(contacts[0].id, ['test-tag']);
              } else {
                results = { message: 'No contacts found to test tag removal with' };
              }
              testMethod = 'Remove Tags from Contact';
            } catch (error) {
              throw new Error(`removeTags failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Conversation Tools
          case 'searchConversation':
            try {
              results = await client.searchConversation({ limit: 5 });
              testMethod = 'Search Conversations';
            } catch (error) {
              throw new Error(`searchConversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getConversations':
            try {
              results = await client.getConversations({ limit: 5 });
              testMethod = 'Get Conversations';
            } catch (error) {
              throw new Error(`getConversations failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getMessages':
            try {
              // This requires a conversationId - we'll use a placeholder
              results = await client.getMessages('test-conversation-id', { limit: 5 });
              testMethod = 'Get Messages';
            } catch (error) {
              throw new Error(`getMessages failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'sendMessage':
            try {
              // This requires a conversationId - we'll use a placeholder
              results = await client.sendMessage('test-conversation-id', 'Test message from MCP', 'SMS');
              testMethod = 'Send Message';
            } catch (error) {
              throw new Error(`sendMessage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Opportunity Tools
          case 'getOpportunities':
            try {
              results = await client.getOpportunities({ limit: 5 });
              testMethod = 'Get Opportunities';
            } catch (error) {
              throw new Error(`getOpportunities failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'searchOpportunity':
            try {
              results = await client.searchOpportunity({ limit: 5 });
              testMethod = 'Search Opportunities';
            } catch (error) {
              throw new Error(`searchOpportunity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getOpportunity':
            try {
              // This requires an opportunityId - we'll use a placeholder
              results = await client.getOpportunity('test-opportunity-id');
              testMethod = 'Get Single Opportunity';
            } catch (error) {
              throw new Error(`getOpportunity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'updateOpportunity':
            try {
              // This requires an opportunityId - we'll use a placeholder
              results = await client.updateOpportunity('test-opportunity-id', {
                name: 'Updated Opportunity Name'
              });
              testMethod = 'Update Opportunity';
            } catch (error) {
              throw new Error(`updateOpportunity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Pipeline Tools
          case 'getPipelines':
            try {
              results = await client.getPipelines();
              testMethod = 'Get Pipelines';
            } catch (error) {
              throw new Error(`getPipelines failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Location Tools
          case 'getLocation':
            try {
              results = await client.getLocation();
              testMethod = 'Get Location';
            } catch (error) {
              throw new Error(`getLocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getCustomFields':
            try {
              results = await client.getCustomFields();
              testMethod = 'Get Custom Fields';
            } catch (error) {
              throw new Error(`getCustomFields failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // User & Tag Tools
          // Note: getUsers and getTags are not part of the official 21 MCP tools

          // Note: getWorkflows is not part of the official 21 MCP tools

          case 'listTools':
            try {
              results = await client.listTools();
              testMethod = 'List All Available Tools';
            } catch (error) {
              throw new Error(`listTools failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          // Payment Tools
          case 'listTransactions':
            try {
              results = await client.listTransactions({ limit: 5 });
              testMethod = 'List Payment Transactions';
            } catch (error) {
              throw new Error(`listTransactions failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'getOrderById':
            try {
              // This requires an orderId - we'll use a placeholder
              results = await client.getOrderById('test-order-id');
              testMethod = 'Get Order by ID';
            } catch (error) {
              throw new Error(`getOrderById failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          default:
            return NextResponse.json({
              success: false,
              message: `Unknown test method: ${method}`
            }, { status: 400 });
        }

        await client.disconnect();

        return NextResponse.json({
          success: true,
          message: `${testMethod} API call successful`,
          results: {
            count: Array.isArray(results) ? results.length : (results ? 1 : 0),
            sampleData: Array.isArray(results) ? results.slice(0, 2) : results,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error(`MCP API test (${method}) failed:`, error);
        return NextResponse.json({
          success: false,
          message: `${method} API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      message: `Unknown action: ${action}`
    }, { status: 400 });

  } catch (error) {
    console.error('MCP test error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error during MCP testing',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}