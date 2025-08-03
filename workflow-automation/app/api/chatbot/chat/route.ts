import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { decrypt } from '@/lib/utils/encryption';
import { ApiKeyManager } from '@/lib/utils/api-key-manager';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chatbot API called');
    const { userId } = await requireAuth(request);
    console.log('👤 User ID:', userId);
    const supabase = getServiceSupabase();
    const { message, conversationHistory = [] } = await request.json();
    console.log('💬 Message received:', message);

    // IMMEDIATE debug log to Recent Results to test if this is working
    try {
      const immediateDebug = await fetch(`http://localhost:3000/api/mcp/ghl/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'debug_chatbot', 
          debug_info: {
            test: 'CHATBOT_API_CALLED',
            message: message,
            timestamp: new Date().toISOString()
          }
        })
      });
      console.log('✅ Immediate debug sent to Recent Results');
    } catch (err) {
      console.log('❌ Failed to send immediate debug:', err);
    }

    if (!message?.trim()) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 });
    }

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
        response: "I need a GoHighLevel integration to help you build chatbot features. Please connect your GHL account first in the Integrations tab."
      });
    }

    // Get MCP token from user_api_keys table with provider 'ghlmcp'
    let mcpToken;
    try {
      mcpToken = await ApiKeyManager.getApiKey(userId, 'ghlmcp');
      if (!mcpToken) {
        return NextResponse.json({
          response: "I need a GoHighLevel MCP token to access your GHL data. Please add your GHL MCP Private Integration Token with provider 'ghlmcp' in the Integrations page."
        });
      }
      console.log('Retrieved MCP token (first 10 chars):', mcpToken.substring(0, 10));
    } catch (error) {
      console.error('Error getting MCP token:', error);
      return NextResponse.json({
        response: "I encountered an error retrieving your MCP token. Please check your GoHighLevel MCP integration settings."
      });
    }

    // Extract location ID from integration config
    const locationId = integration.config?.locationId || integration.location_id || integration.config?.location_id;
    
    if (!locationId) {
      console.error('No location ID found in integration:', JSON.stringify(integration, null, 2));
      return NextResponse.json({
        response: "I couldn't find the GoHighLevel location ID in your integration settings. Please reconnect your GoHighLevel integration to ensure the location ID is properly stored."
      });
    }

    console.log('Using location ID:', locationId);
    console.log('Integration config:', JSON.stringify(integration.config, null, 2));
    
    // Make a simple test call to log debug info to Recent Results panel - BEFORE creating MCP client
    try {
      console.log('Sending debug info to Recent Results...');
      const debugResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp/ghl/test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ 
          action: 'debug_chatbot', 
          debug_info: {
            locationId: locationId,
            hasMcpToken: !!mcpToken,
            mcpTokenStart: mcpToken?.substring(0, 10),
            tokenLength: mcpToken?.length,
            userId: userId
          }
        })
      });
      
      const debugResult = await debugResponse.json();
      console.log('Debug response:', debugResult);
    } catch (debugError) {
      console.log('Debug logging failed:', debugError);
    }

    // Create MCP client
    let client;
    try {
      client = await createGHLMCPClient({
        mcpToken,
        locationId: locationId
      });

      if (!client) {
        return NextResponse.json({
          response: "I'm having trouble creating the MCP client connection to GoHighLevel. Please check your MCP token and try again."
        });
      }
    } catch (mcpConnectionError) {
      console.error('MCP client creation error:', mcpConnectionError);
      console.error('Used location ID:', locationId);
      console.error('Used MCP token (first 10 chars):', mcpToken?.substring(0, 10));
      return NextResponse.json({
        response: `I encountered an error connecting to GoHighLevel MCP: ${mcpConnectionError instanceof Error ? mcpConnectionError.message : 'Unknown connection error'}. Please check your MCP integration settings in the GoHighLevel page.`
      });
    }

    // Get user's OpenAI API key
    const openaiKey = await getUserOpenAIKey(userId);
    if (!openaiKey) {
      return NextResponse.json({
        response: "I need an OpenAI API key to provide intelligent responses. Please add your OpenAI API key in the Integrations page to enable AI-powered chatbot features."
      });
    }

    // Process the message with AI and MCP tools
    const response = await processAIChatbotMessage(message, client, integration, openaiKey, supabase, conversationHistory);
    
    await client.disconnect();

    return NextResponse.json({ response });

  } catch (error) {
    console.error('Chatbot error:', error);
    return NextResponse.json({
      response: "I encountered an error while processing your request. Let me help you get started with some basic chatbot features instead!"
    });
  }
}

async function getUserOpenAIKey(userId: string): Promise<string | null> {
  try {
    // Use the correct method name and get the decrypted key directly
    const decryptedKey = await ApiKeyManager.getApiKey(userId, 'openai');
    return decryptedKey;
  } catch (error) {
    console.error('Error getting OpenAI key:', error);
    return null;
  }
}

async function processAIChatbotMessage(
  message: string, 
  client: any, 
  integration: any, 
  openaiKey: string, 
  supabase: any,
  conversationHistory: any[] = []
): Promise<string> {
  try {
    console.log('🤖 Starting AI chatbot processing for message:', message);
    console.log('🔗 Integration location ID:', integration.config?.locationId);
    
    const openai = new OpenAI({ apiKey: openaiKey });
    
    // Create function definitions for all MCP tools
    const functions = [
      {
        name: "get_contacts",
        description: "Search and retrieve contacts from GoHighLevel by name, email, or phone",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of contacts to retrieve (max 100)" },
            query: { type: "string", description: "Search query for contacts (searches name, email, phone)" }
          }
        }
      },
      {
        name: "get_contact",
        description: "Get details of a specific contact by ID",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "The ID of the contact to retrieve" }
          },
          required: ["contactId"]
        }
      },
      {
        name: "create_contact",
        description: "Create a new contact in GoHighLevel",
        parameters: {
          type: "object",
          properties: {
            firstName: { type: "string", description: "First name" },
            lastName: { type: "string", description: "Last name" },
            email: { type: "string", description: "Email address" },
            phone: { type: "string", description: "Phone number" }
          },
          required: ["firstName", "email"]
        }
      },
      {
        name: "search_opportunities",
        description: "Search for opportunities in GoHighLevel",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of opportunities to retrieve" },
            pipelineId: { type: "string", description: "Filter by pipeline ID" }
          }
        }
      },
      {
        name: "get_pipelines",
        description: "Get all sales pipelines from GoHighLevel",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "add_tags_to_contact",
        description: "Add tags to a contact",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "Contact ID" },
            tags: { type: "array", items: { type: "string" }, description: "Tags to add" }
          },
          required: ["contactId", "tags"]
        }
      },
      {
        name: "get_contact_tasks",
        description: "Get all tasks for a contact",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "Contact ID" }
          },
          required: ["contactId"]
        }
      },
      {
        name: "search_conversations",
        description: "Search conversations for a contact",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "Contact ID" }
          },
          required: ["contactId"]
        }
      },
      {
        name: "get_contact_appointments",
        description: "Get appointments for a contact",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "Contact ID" },
            startDate: { type: "string", description: "Start date (optional)" },
            endDate: { type: "string", description: "End date (optional)" }
          },
          required: ["contactId"]
        }
      },
      {
        name: "get_payments",
        description: "Get payment transactions",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "Contact ID (optional)" },
            status: { type: "string", description: "Payment status (optional)" }
          }
        }
      },
      {
        name: "send_message",
        description: "Send a message (SMS or Email) to a contact",
        parameters: {
          type: "object",
          properties: {
            contactId: { type: "string", description: "The ID of the contact to send the message to" },
            message: { type: "string", description: "The message content to send" },
            type: { type: "string", enum: ["SMS", "Email"], description: "Type of message to send (SMS or Email)" }
          },
          required: ["contactId", "message"]
        }
      }
    ];

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content: `You are a GoHighLevel data assistant. You have access to GoHighLevel data through MCP tools.

Your role is to:
1. Execute the user's requests by calling the appropriate MCP tools
2. Return ONLY the requested data - be direct and focused
3. When asked about specific data (invoices, appointments, etc.), silently get the contact ID first, then return ONLY the requested information

IMPORTANT RESPONSE RULES:
- If asked "Who is [name]?" → Show contact details
- If asked "Show [name]'s invoices/appointments/tasks" → Show ONLY that data, NOT contact info
- Always get contact ID first when needed, but don't mention this process to the user

Available Tools:
- get_contacts: Search contacts by name, email, or phone. Returns contact IDs needed for other operations
- get_contact: Get full details for a specific contact using their ID
- create_contact: Create new contacts
- search_opportunities: Find opportunities (may require contact ID)
- get_pipelines: Get sales pipelines
- add_tags_to_contact: Add tags to contacts (requires contact ID)
- get_contact_tasks: Get all tasks for a contact (requires contact ID)
- search_conversations: Search conversations for a contact (requires contact ID)
- get_contact_appointments: Get appointments for a contact (requires contact ID)
- get_payments: Get payment transactions and invoices
- send_message: Send SMS or Email messages to contacts (requires contact ID)

CRITICAL WORKFLOW:
When user asks for specific data about a person (invoices, appointments, tasks, etc.):
1. FIRST CALL: get_contacts to find the person and get their contact ID
2. SECOND CALL: Use that contact ID to get the requested data
3. RETURN: Only the requested data, not the contact information

The system supports multiple function calls - you will automatically be prompted to make the second call after getting the contact ID.

IMPORTANT: Do NOT say "I found X" or "Let me check" - just make the calls and return the data.

When searching for contacts:
1. Use get_contacts with a query parameter
2. The system intelligently searches based on what you provide:
   - Single name (e.g., "Brandon") → Searches first_name, last_name, and contact_name fields
   - Full name (e.g., "Brandon Burgan") → Searches contact_name field and first+last combination
   - Email or phone → Searches those specific fields
3. Always provide clear, helpful responses with the contact information found

Decision flow for ALL queries:
1. If query mentions a person by name → ALWAYS start with get_contacts to get their ID
2. If query already has a contact ID → Use it directly in the appropriate function
3. For any person-specific data (bills, appointments, etc.) → Get contact ID first

Examples:
- "Who is Brandon Burgan?" → Single call: get_contacts({"query": "Brandon Burgan"}) → Show contact info
- "Show Brandon Burgan's tasks" → Two calls: get_contacts then get_contact_tasks → Show only tasks
- "Get Mary's appointments" → Two calls: get_contacts then get_contact_appointments → Show only appointments
- "Brandon's outstanding invoices" → Two calls: get_contacts then get_payments → Show only invoices
- "Send Brandon a message asking him to schedule an estimate" → Two calls: get_contacts then send_message → Compose and send appropriate message

MESSAGE SENDING WORKFLOW:
When user asks to send a message to someone:
1. FIRST: Use get_contacts to find the person and get their contact ID
2. COMPOSE: Create an appropriate message based on the user's request
3. SEND: Use send_message with the contact ID and composed message
4. CONFIRM: Let the user know the message was sent

Message Composition Guidelines:
- Be professional and courteous
- Include relevant context from the user's request
- For scheduling requests, suggest flexibility (e.g., "Would you be available for...")
- Keep messages concise and action-oriented
- Default to SMS unless email is specifically requested

Remember: The system handles multiple calls automatically. Focus on what data to retrieve.

CONTEXT AWARENESS:
- Pay attention to the conversation history
- If a contact was mentioned in a previous message, use that context for follow-up questions
- Examples of context-aware responses:
  - User: "Who is Brandon Burgan?" Bot: [provides info]
  - User: "Show me his outstanding invoices" → Bot knows "his" refers to Brandon Burgan
  - User: "What about appointments?" → Bot still knows we're talking about Brandon Burgan

Remember: The contact ID from get_contacts is your key to accessing all other customer data!

IMPORTANT API LIMITATIONS:
- Calendar Events: GoHighLevel's calendars_get-calendar-events API does NOT support filtering by contact ID. It only accepts userId, calendarId, or groupId.
- When asked for a contact's appointments: Be transparent about this limitation. Explain that you can get all calendar events but cannot filter by specific contact.
- Suggest alternatives: "I can show all calendar events for the location, but GoHighLevel's API doesn't support filtering by specific contact. You may need to use the web interface to see contact-specific appointments."`
      }
    ];
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      console.log(`📜 Including ${conversationHistory.length} messages from conversation history`);
      messages.push(...conversationHistory);
    }
    
    // Add current user message
    messages.push({
      role: "user",
      content: message
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      functions: functions,
      function_call: "auto",
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = completion.choices[0].message;
    console.log('🤖 AI Response:', {
      content: assistantMessage.content,
      function_call: assistantMessage.function_call
    });

    // Handle function calls - support multiple sequential calls
    let functionResults = [];
    let currentMessages = [...messages];
    let maxCalls = 3; // Allow up to 3 sequential function calls
    
    for (let i = 0; i < maxCalls; i++) {
      // Get completion if this isn't the first iteration
      let currentAssistantMessage = i === 0 ? assistantMessage : null;
      
      if (i > 0) {
        const intermediateCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: currentMessages,
          functions: functions,
          function_call: "auto",
          temperature: 0.7,
          max_tokens: 1000
        });
        currentAssistantMessage = intermediateCompletion.choices[0].message;
      }
      
      // Check if there's a function call
      if (!currentAssistantMessage?.function_call) {
        // No more function calls needed
        if (currentAssistantMessage?.content) {
          return currentAssistantMessage.content;
        }
        break;
      }
      
      const functionName = currentAssistantMessage.function_call.name;
      const functionArgs = JSON.parse(currentAssistantMessage.function_call.arguments || '{}');
      
      console.log(`\n🔧 [Call ${i + 1}] AI wants to call function:`, functionName);
      console.log('📝 Function arguments:', JSON.stringify(functionArgs, null, 2));
      
      let functionResult;
      
      try {
        switch (functionName) {
          case 'get_contacts':
            console.log('📞 Searching contacts with args:', functionArgs);
            
            // Search in Supabase first for efficient querying
            const locationId = integration.config?.locationId;
            console.log('📍 Using location ID:', locationId);
            
            if (!locationId) {
              functionResult = { error: 'Location ID not found' };
              break;
            }
            
            let query = supabase
              .from('ghl_contacts')
              .select('*')
              .eq('location_id', locationId)
              .eq('sync_status', 'active');
            
            // Apply search filter if provided
            if (functionArgs.query) {
              const searchTerm = functionArgs.query.toLowerCase().trim();
              console.log('🔎 Search term:', searchTerm);
              
              // Check if it's a single word (likely first or last name) or multiple words (full name)
              const words = searchTerm.split(' ').filter(w => w.length > 0);
              
              if (words.length === 1) {
                // Single word - search in first_name, last_name, and contact_name
                console.log('🔍 Searching for single name:', words[0]);
                query = query.or(`first_name.ilike.%${words[0]}%,last_name.ilike.%${words[0]}%,contact_name.ilike.%${words[0]}%`);
              } else if (words.length === 2) {
                // Two words - could be "first last" or search in contact_name for full match
                console.log('🔍 Searching for full name:', searchTerm);
                // Search for exact match in contact_name OR first+last combination
                query = query.or(`contact_name.ilike.%${searchTerm}%,and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words[1]}%)`);
              } else {
                // Multiple words - search in contact_name, email, phone
                console.log('🔍 Searching across all fields:', searchTerm);
                query = query.or(`contact_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
              }
            }
            
            // Apply limit
            if (functionArgs.limit) {
              query = query.limit(functionArgs.limit);
            } else {
              query = query.limit(50); // Default limit
            }
            
            const { data: contacts, error: dbError } = await query;
            
            if (dbError) {
              console.error('Database search error:', dbError);
              // Fallback to MCP if database fails
              functionResult = await client.getContacts(functionArgs);
            } else {
              console.log(`✅ Found ${contacts?.length || 0} contacts in database`);
              if (contacts && contacts.length > 0) {
                console.log('📋 First few results:', contacts.slice(0, 3).map(c => ({
                  id: c.contact_id,
                  name: c.contact_name,
                  phone: c.phone
                })));
              }
              
              // Return database results directly
              functionResult = contacts?.map(c => ({
                  id: c.contact_id,
                  locationId: c.location_id,
                  firstName: c.first_name,
                  lastName: c.last_name,
                  contactName: c.contact_name,
                  email: c.email,
                  phone: c.phone,
                  type: c.type,
                  tags: c.tags,
                  customFields: c.custom_fields,
                  dateAdded: c.date_added,
                  dateUpdated: c.date_updated
                })) || [];
            }
            break;
          case 'get_contact':
            functionResult = await client.getContact(functionArgs.contactId);
            break;
          case 'create_contact':
            functionResult = await client.createContact(functionArgs);
            break;
          case 'search_opportunities':
            functionResult = await client.searchOpportunity(functionArgs);
            break;
          case 'get_pipelines':
            functionResult = await client.getPipelines();
            break;
          case 'add_tags_to_contact':
            functionResult = await client.addTags(functionArgs.contactId, functionArgs.tags);
            break;
          case 'get_contact_tasks':
            functionResult = await client.getAllTasks(functionArgs.contactId);
            break;
          case 'search_conversations':
            // For now, return a placeholder - conversations API needs implementation
            functionResult = { 
              message: "Conversation search is not yet implemented",
              contactId: functionArgs.contactId 
            };
            break;
          case 'get_contact_appointments':
            console.log('📅 Getting appointments for contact:', functionArgs.contactId);
            
            // Get current date and date range (1 month back to 3 months forward)
            const now = new Date();
            const startTime = new Date(now);
            startTime.setMonth(startTime.getMonth() - 1);
            const endTime = new Date(now);
            endTime.setMonth(endTime.getMonth() + 3);
            
            // GoHighLevel's calendar events API doesn't filter by contact ID directly
            // We need to get ALL events and filter client-side, or use a different approach
            // For now, return a helpful message explaining the limitation
            
            try {
              // Try to get calendar events for the location
              const calendarResult = await client.callTool('calendars_get-calendar-events', {
                query_startTime: functionArgs.startDate || startTime.toISOString(),
                query_endTime: functionArgs.endDate || endTime.toISOString()
              });
              
              console.log('📅 Calendar events result:', JSON.stringify(calendarResult, null, 2));
              
              // Check if we got events back
              if (calendarResult && calendarResult.content) {
                functionResult = {
                  message: "Calendar events retrieved, but filtering by specific contact is not directly supported by GoHighLevel API",
                  events: calendarResult,
                  note: "To find appointments for a specific contact, you would need to search through all appointments and match by attendee information"
                };
              } else {
                functionResult = calendarResult;
              }
            } catch (calendarError) {
              console.error('Calendar error:', calendarError);
              functionResult = {
                message: "I can retrieve calendar events, but GoHighLevel doesn't support filtering appointments by contact ID directly. You would need to get all appointments and filter by attendee information.",
                suggestion: "Try asking for all appointments in a date range, or use the GoHighLevel web interface to view contact-specific appointments."
              };
            }
            break;
          case 'get_payments':
            // Use the payments API
            functionResult = await client.listTransactions({
              contactId: functionArgs.contactId,
              status: functionArgs.status
            });
            break;
          case 'send_message':
            console.log('📨 Sending message to contact:', functionArgs.contactId);
            
            // GoHighLevel MCP expects specific parameter names with prefixes
            // Use the conversations_send-a-new-message tool directly with correct params
            functionResult = await client.callTool('conversations_send-a-new-message', {
              body_type: functionArgs.type || 'SMS',
              body_contactId: functionArgs.contactId,
              body_message: functionArgs.message
            });
            
            console.log('📬 Message sent result:', functionResult);
            break;
          default:
            functionResult = { error: `Function ${functionName} not implemented` };
        }
      } catch (mcpError) {
        console.error(`MCP function ${functionName} error:`, mcpError);
        functionResult = { 
          error: `MCP Error: ${mcpError instanceof Error ? mcpError.message : 'Unknown MCP error'}`,
          suggestion: "The GoHighLevel MCP integration may need to be reconnected. Please check your MCP token in the GoHighLevel settings."
        };
      }

      console.log('📊 Function result:', JSON.stringify(functionResult, null, 2));
      
      // Add function call and result to message history
      currentMessages.push({
        role: "assistant",
        content: null,
        function_call: currentAssistantMessage.function_call
      });
      
      currentMessages.push({
        role: "function",
        name: functionName,
        content: JSON.stringify(functionResult)
      });
      
      functionResults.push({ name: functionName, result: functionResult });
    }
    
    // After all function calls are complete, get final response
    console.log(`\n✅ Completed ${functionResults.length} function calls`);
    
    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: currentMessages,
      temperature: 0.7,
      max_tokens: 1000
    });
    
    return finalCompletion.choices[0].message.content || "I've completed the requested action.";
    
  } catch (error) {
    console.error('🤖 AI processing error:', error);
    return "I encountered an error while processing your request. Please try again.";
  }
}

// Note: Legacy command handling removed - now using AI-powered responses