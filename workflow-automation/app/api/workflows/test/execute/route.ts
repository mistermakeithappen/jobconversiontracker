import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, requireAuthWithOrg } from '@/lib/auth/production-auth-server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { executeMessageNode } from './message-node';
import { decrypt } from '@/lib/utils/encryption';

interface WorkflowNode {
  node_id: string;
  type: string;
  title: string;
  config: any;
  position: { x: number; y: number };
  goal_description?: string; // For milestone nodes
  possible_outcomes?: string[]; // For milestone nodes
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  source_node_id?: string; // Alternative property name
  target_node_id?: string; // Alternative property name
  connection_type?: string;
}

interface ExecutionContext {
  sessionId: string;
  variables: Record<string, any>;
  conversationHistory: Array<{ role: string; content: string }>;
  currentNodeId: string | null;
  organizationId: string;
  integrationId?: string;
  businessContext?: any;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        console.log('=== WORKFLOW TEST EXECUTION STARTED ===');
        console.log('Request body:', body);
        
        const { workflowId, sessionId, message, nodes, edges, variables = {}, botId } = body;
        
        console.log('Workflow execution started:', { workflowId, sessionId, message });
        console.log('Nodes count:', nodes?.length || 0);
        console.log('Edges count:', edges?.length || 0);
        console.log('First few nodes:', nodes?.slice(0, 3));
        
        // Get authenticated user and organization
        const supabase = getServiceSupabase();
        
        let userId, organization;
        try {
          const authData = await requireAuthWithOrg(request);
          userId = authData.userId;
          organization = authData.organization;
          console.log('Auth data received:', { userId, organization });
        } catch (error) {
          console.error('Auth error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Authentication required' })}\n\n`));
          controller.close();
          return;
        }
        
        if (!organization || (!organization.id && !organization.organizationId)) {
          console.error('Organization ID is missing from auth data:', organization);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Organization not found' })}\n\n`));
          controller.close();
          return;
        }

        // Get GHL integration for the organization
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('organization_id', organization.organizationId || organization.id)
          .eq('type', 'gohighlevel')
          .eq('is_active', true)
          .single();

        // Get bot-specific context if botId is provided
        const orgId = organization.organizationId || organization.id;
        let businessContext = null;
        
        if (botId) {
          const { data: botContext } = await supabase
            .from('bot_contexts')
            .select('*')
            .eq('bot_id', botId)
            .single();
          
          businessContext = botContext;
          console.log('Bot context found:', !!botContext);
        }

        // Initialize execution context
        const context: ExecutionContext = {
          sessionId,
          variables: { ...variables },
          conversationHistory: [],
          currentNodeId: null,
          organizationId: orgId,
          integrationId: integration?.id,
          businessContext
        };

        // Add user message to history
        context.conversationHistory.push({ role: 'user', content: message });

        // Normalize edges to ensure consistent property names
        const normalizedEdges = edges.map((e: any) => ({
          ...e,
          source: e.source || e.source_node_id,
          target: e.target || e.target_node_id,
          source_node_id: e.source_node_id || e.source,
          target_node_id: e.target_node_id || e.target
        }));
        
        console.log('Normalized edges:', normalizedEdges);

        // Log all node types to debug
        console.log('Available nodes:', nodes.map((n: WorkflowNode) => ({ 
          id: n.node_id, 
          type: n.type || n.node_type,
          title: n.title 
        })));
        
        // Find the start node - prefer milestone, then start, then AI, then first node
        // Check both 'type' and 'node_type' properties
        const startNode = nodes.find((n: WorkflowNode) => 
          n.type === 'milestone' || n.node_type === 'milestone'
        ) ||
        nodes.find((n: WorkflowNode) => 
          n.type === 'start' || n.node_type === 'start'
        ) ||
        nodes.find((n: WorkflowNode) => 
          n.type === 'ai' || n.node_type === 'ai'
        ) || 
        nodes[0];
        
        console.log('Start node found:', startNode);
        
        if (!startNode) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'No start node found' })}\n\n`));
          controller.close();
          return;
        }

        // Execute workflow starting from the start node
        console.log('Executing workflow from start node:', startNode.node_id);
        try {
          await executeNode(startNode, nodes, normalizedEdges, context, controller, encoder, supabase);
        } catch (nodeError) {
          console.error('Error during node execution:', nodeError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: `Node execution failed: ${nodeError instanceof Error ? nodeError.message : 'Unknown error'}` 
          })}\n\n`));
        }

        // Send completion signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
        controller.close();
      } catch (error) {
        console.error('Workflow execution error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error occurred' 
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function executeNode(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any
) {
  console.log('executeNode called for:', node);
  
  // Send node execution event
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    type: 'node_execution',
    nodeId: node.node_id,
    nodeName: node.title || node.type
  })}\n\n`));

  context.currentNodeId = node.node_id;

  // Execute based on node type - check both 'type' and 'node_type'
  const nodeType = node.type || node.node_type;
  let nextNodeId: string | null = null;
  let nextSourceHandle: string | null = null;

  console.log(`Executing node type: ${nodeType}`);

  switch (nodeType) {
    case 'ai':
      nextNodeId = await executeAINode(node, context, controller, encoder, supabase);
      break;
    
    case 'milestone':
      nextNodeId = await executeMilestoneNode(node, context, controller, encoder, supabase);
      break;
    
    case 'appointment':
    case 'book_appointment':
      nextNodeId = await executeAppointmentNode(node, context, controller, encoder, supabase);
      nextSourceHandle = 'standard'; // Default to standard flow
      break;
    
    case 'message':
      nextNodeId = await executeMessageNode(node, context, controller, encoder, supabase, executeAIResponse);
      break;
    
    case 'ghl_action':
      nextNodeId = await executeGHLActionNode(node, context, controller, encoder, supabase);
      break;
    
    case 'condition':
      const result = await executeConditionNode(node, context, controller, encoder);
      nextNodeId = result.nextNodeId;
      nextSourceHandle = result.sourceHandle;
      break;
    
    case 'variable':
      nextNodeId = await executeVariableNode(node, context, controller, encoder);
      break;
    
    default:
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'debug',
        message: `Unknown node type: ${nodeType}`
      })}\n\n`));
      console.warn(`Unknown node type: ${nodeType}`);
  }

  // Find next node to execute
  console.log('Looking for next node. nextNodeId:', nextNodeId);
  console.log('Current node edges:', edges.filter(e => 
    (e.source === node.node_id || e.source_node_id === node.node_id)
  ));
  
  if (nextNodeId) {
    const nextNode = allNodes.find(n => n.node_id === nextNodeId);
    if (nextNode) {
      console.log('Found next node by ID:', nextNode);
      // Add small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 500));
      await executeNode(nextNode, allNodes, edges, context, controller, encoder, supabase);
    }
  } else {
    // Find connected nodes based on edges - check both property names
    const outgoingEdges = edges.filter(e => {
      const sourceMatch = (e.source === node.node_id || e.source_node_id === node.node_id);
      const handleMatch = !nextSourceHandle || 
        e.sourceHandle === nextSourceHandle || 
        e.connection_type === nextSourceHandle;
      return sourceMatch && handleMatch;
    });
    
    console.log('Outgoing edges:', outgoingEdges);
    
    if (outgoingEdges.length > 0) {
      const nextEdge = outgoingEdges[0];
      const targetId = nextEdge.target || nextEdge.target_node_id;
      const nextNode = allNodes.find(n => n.node_id === targetId);
      console.log('Next edge target:', targetId);
      console.log('Found next node:', nextNode);
      
      if (nextNode) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await executeNode(nextNode, allNodes, edges, context, controller, encoder, supabase);
      }
    } else {
      console.log('No more nodes to execute');
    }
  }
}

async function executeAINode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any
): Promise<string | null> {
  try {
    const config = node.config || {};
    
    // Debug: Log the node configuration
    console.log('AI Node Config:', config);
    console.log('Conversation History:', context.conversationHistory);
    
    // Send backend log
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: 'Fetching OpenAI API key from database...',
      data: { provider: 'openai', organizationId: context.organizationId }
    })}\n\n`));
    
    // Get API key from user settings
    console.log('Fetching OpenAI API key for organization:', context.organizationId);
    const { data: userApiKey, error: apiKeyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('organization_id', context.organizationId)
      .eq('service', 'openai')
      .eq('is_active', true)
      .single();
    
    if (apiKeyError) {
      console.error('Error fetching API key:', apiKeyError);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'backend_log',
        content: `Error fetching API key: ${apiKeyError.message}`,
        data: { error: apiKeyError }
      })}\\n\\n`));
    }

    if (!userApiKey?.encrypted_key) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'message',
        content: 'OpenAI API key not configured. Please add your API key in settings.',
        nodeId: node.node_id
      })}\n\n`));
      return null;
    }

    let decryptedKey;
    try {
      decryptedKey = decrypt(userApiKey.encrypted_key);
    } catch (decryptError) {
      console.error('Failed to decrypt OpenAI API key:', decryptError);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'message',
        content: 'Failed to decrypt OpenAI API key. Please reconfigure in settings.',
        nodeId: node.node_id
      })}\n\n`));
      return null;
    }

    const openai = new OpenAI({ apiKey: decryptedKey });

    // Build system prompt
    let systemPrompt = config.system_prompt || 'You are a helpful AI assistant.';
    
    // Replace variables in prompt
    systemPrompt = replaceVariables(systemPrompt, context.variables);

    // Add conversation history if configured
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (config.include_history) {
      messages.push(...context.conversationHistory);
    } else {
      // Just add the latest user message
      messages.push(context.conversationHistory[context.conversationHistory.length - 1]);
    }

    // Send backend log about API call
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `Calling OpenAI ${config.model || 'gpt-4o-mini'} API...`,
      data: { 
        model: config.model || 'gpt-4o-mini',
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 500,
        messageCount: messages.length
      }
    })}\n\n`));
    
    // Debug: Log the messages being sent
    console.log('Sending to OpenAI:', { 
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 500
    });

    // Make API call
    const completion = await openai.chat.completions.create({
      model: config.model || 'gpt-4o-mini', // Use a model that's more likely to be available
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Debug: Log the response
    console.log('OpenAI Response:', response);
    
    // Send backend log about response
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `Received response from OpenAI (${response.length} chars)`,
      data: { responseLength: response.length }
    })}\n\n`));
    
    // Add to conversation history
    context.conversationHistory.push({ role: 'assistant', content: response });

    // Send response
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: response,
      nodeId: node.node_id
    })}\n\n`));

    // Store response in variable if configured
    if (config.store_in_variable) {
      context.variables[config.store_in_variable] = response;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'variable_update',
        variable: config.store_in_variable,
        value: response
      })}\n\n`));
    }

    return null; // Let edge connections determine next node
  } catch (error) {
    console.error('AI node execution error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI response';
    
    // Send more detailed error information
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: `Error: ${errorMessage}`,
      nodeId: node.node_id
    })}\n\n`));
    
    // Also send debug information
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'debug',
      message: `AI Node Error: ${errorMessage}`,
      nodeId: node.node_id
    })}\n\n`));
    
    return null;
  }
}

async function executeAppointmentNode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any
): Promise<string | null> {
  try {
    const config = node.config || {};
    
    // Store appointment context
    context.variables.appointment_requested = true;
    context.variables.appointment_calendar = config.calendar_name || config.calendar_id;
    
    // Create AI prompt for appointment booking
    const systemPrompt = `You are a helpful AI assistant managing appointment bookings.

${context.variables.user_goal ? `The user's overall goal is: "${context.variables.user_goal}"` : ''}

You are now at the appointment booking stage. Your task is to:
1. Understand what type of appointment they need
2. Suggest available time slots (in a real system, you'd check actual availability)
3. Confirm their appointment details

Calendar: ${config.calendar_name || 'General Appointments'}
${config.reminder_message ? `Reminder message: ${config.reminder_message}` : ''}
${config.booking_confirmation_message ? `Confirmation message template: ${config.booking_confirmation_message}` : ''}

Be helpful and guide them through the booking process conversationally.`;

    // Execute AI response with appointment context
    await executeAIResponse(node, context, controller, encoder, supabase, {
      systemPrompt,
      includeHistory: true,
      storeResponseAs: 'appointment_response'
    });

    return null; // Let edges determine flow
  } catch (error) {
    console.error('Appointment node error:', error);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: `Appointment node error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })}\n\n`));
    return null;
  }
}

async function executeGHLActionNode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any
): Promise<string | null> {
  try {
    const config = node.config || {};
    const actionType = config.action_type;

    // In test mode, simulate the action
    let message = '';
    switch (actionType) {
      case 'update_contact':
        message = '✅ Contact information has been updated.';
        context.variables.contact_updated = true;
        break;
      case 'add_tag':
        message = `🏷️ Tag "${config.tag || 'workflow-processed'}" has been added to the contact.`;
        break;
      case 'create_opportunity':
        message = '💼 New opportunity has been created in the pipeline.';
        context.variables.opportunity_created = true;
        break;
      case 'send_email':
        message = '📧 Email has been sent successfully.';
        break;
      default:
        message = `✅ Action "${actionType}" has been completed.`;
    }

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: message,
      nodeId: node.node_id
    })}\n\n`));

    return null;
  } catch (error) {
    console.error('GHL action node error:', error);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: 'Failed to execute GoHighLevel action.',
      nodeId: node.node_id
    })}\n\n`));
    return null;
  }
}

async function executeConditionNode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<{ nextNodeId: string | null; sourceHandle: string | null }> {
  try {
    const config = node.config || {};
    const variable = context.variables[config.variable];
    const operator = config.operator || 'equals';
    const value = config.value;

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = variable == value;
        break;
      case 'not_equals':
        conditionMet = variable != value;
        break;
      case 'contains':
        conditionMet = variable && String(variable).includes(value);
        break;
      case 'greater_than':
        conditionMet = Number(variable) > Number(value);
        break;
      case 'less_than':
        conditionMet = Number(variable) < Number(value);
        break;
      case 'is_empty':
        conditionMet = !variable || variable === '';
        break;
      case 'is_not_empty':
        conditionMet = !!variable && variable !== '';
        break;
    }

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'debug',
      message: `Condition: ${config.variable} ${operator} ${value} = ${conditionMet ? 'TRUE' : 'FALSE'}`
    })}\n\n`));

    return {
      nextNodeId: null,
      sourceHandle: conditionMet ? 'true' : 'false'
    };
  } catch (error) {
    console.error('Condition node error:', error);
    return { nextNodeId: null, sourceHandle: 'false' };
  }
}

async function executeVariableNode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string | null> {
  try {
    const config = node.config || {};
    const variableName = config.variable_name;
    const value = replaceVariables(config.value || '', context.variables);

    if (variableName) {
      context.variables[variableName] = value;
      
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'variable_update',
        variable: variableName,
        value: value
      })}\n\n`));

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'debug',
        message: `Set variable "${variableName}" = "${value}"`
      })}\n\n`));
    }

    return null;
  } catch (error) {
    console.error('Variable node error:', error);
    return null;
  }
}

async function executeMilestoneNode(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any
): Promise<string | null> {
  try {
    console.log('Executing milestone node:', node);
    
    const goalDescription = node.goal_description || '';
    const extraInstructions = node.config?.extra_instructions || '';
    
    console.log('Goal description:', goalDescription);
    console.log('Extra instructions:', extraInstructions);
    
    // Store the goal in context variables so AI can access it
    context.variables.user_goal = goalDescription;
    context.variables.extra_instructions = extraInstructions;
    
    // Send backend log
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `Milestone node: Setting user goal - "${goalDescription}"`,
      data: { goalDescription, extraInstructions }
    })}\n\n`));
    
    // Send variable updates
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'variable_update',
      variable: 'user_goal',
      value: goalDescription
    })}\n\n`));
    
    // Now use AI to respond based on the milestone context
    const systemPrompt = `You are a helpful AI assistant in a goal-oriented conversation flow.

The user has indicated they want to: "${goalDescription}"
${extraInstructions ? `Additional context: ${extraInstructions}` : ''}

Your task is to understand what they need and guide them toward achieving this goal. 
Start by acknowledging their goal and asking clarifying questions to better understand their specific needs.

Be conversational, helpful, and focused on achieving the stated goal.`;

    // Call the common AI execution function with milestone-specific context
    await executeAIResponse(node, context, controller, encoder, supabase, {
      systemPrompt,
      includeHistory: true,
      storeResponseAs: 'milestone_response'
    });
    
    return null; // Let edges determine next node
  } catch (error) {
    console.error('Milestone node error:', error);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: `Milestone node error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })}\n\n`));
    return null;
  }
}

async function executeAIResponse(
  node: WorkflowNode,
  context: ExecutionContext,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  supabase: any,
  options: {
    systemPrompt: string;
    includeHistory?: boolean;
    storeResponseAs?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<void> {
  try {
    // Send backend log
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: 'Fetching OpenAI API key from database...',
      data: { provider: 'openai', organizationId: context.organizationId }
    })}\n\n`));
    
    // Get API key from user settings
    console.log('Fetching OpenAI API key for organization:', context.organizationId);
    const { data: userApiKey, error: apiKeyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('organization_id', context.organizationId)
      .eq('service', 'openai')
      .eq('is_active', true)
      .single();
    
    if (apiKeyError) {
      console.error('Error fetching API key:', apiKeyError);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'backend_log',
        content: `Error fetching API key: ${apiKeyError.message}`,
        data: { error: apiKeyError }
      })}\\n\\n`));
    }

    if (!userApiKey?.encrypted_key) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'message',
        content: 'OpenAI API key not configured. Please add your API key in settings.',
        nodeId: node.node_id
      })}\n\n`));
      return;
    }

    let decryptedKey;
    try {
      decryptedKey = decrypt(userApiKey.encrypted_key);
    } catch (decryptError) {
      console.error('Failed to decrypt OpenAI API key:', decryptError);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'message',
        content: 'Failed to decrypt OpenAI API key. Please reconfigure in settings.',
        nodeId: node.node_id
      })}\n\n`));
      return;
    }

    const openai = new OpenAI({ apiKey: decryptedKey });

    // Build enhanced system prompt with business context
    let enhancedSystemPrompt = options.systemPrompt;
    
    if (context.businessContext) {
      const bc = context.businessContext;
      enhancedSystemPrompt = `## Business Context
You are an AI assistant representing ${bc.business_name}.
Business Type: ${bc.business_type || 'General'}
Industry: ${bc.industry || 'General'}

## Communication Style
- Tone: ${bc.tone_of_voice || 'professional'}
- Language: ${bc.language_style || 'conversational'}

## About the Business
${bc.unique_value_proposition || ''}
Target Audience: ${bc.target_audience || 'General customers'}
Services: ${(bc.services_offered || []).join(', ')}

## Response Guidelines
${(bc.response_guidelines || []).map((g: string) => `- ${g}`).join('\n')}

## Topics to Avoid
${(bc.prohibited_topics || []).map((t: string) => `- ${t}`).join('\n')}

## Escalation Triggers (hand off to human for these)
${(bc.escalation_triggers || []).map((t: string) => `- ${t}`).join('\n')}

${bc.custom_instructions ? `## Additional Instructions\n${bc.custom_instructions}` : ''}

## Current Task
${options.systemPrompt}`;
    }

    // Build messages array
    const messages: any[] = [
      { role: 'system', content: replaceVariables(enhancedSystemPrompt, context.variables) }
    ];

    if (options.includeHistory !== false) {
      messages.push(...context.conversationHistory);
    } else {
      // Just add the latest user message
      messages.push(context.conversationHistory[context.conversationHistory.length - 1]);
    }

    // Send backend log about API call
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `Calling OpenAI API...`,
      data: { 
        model: 'gpt-4o-mini',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500,
        messageCount: messages.length
      }
    })}\n\n`));

    // Make API call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 500,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Send backend log about response
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `Received response from OpenAI (${response.length} chars)`,
      data: { responseLength: response.length }
    })}\n\n`));
    
    // Add to conversation history
    context.conversationHistory.push({ role: 'assistant', content: response });

    // Send response
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: response,
      nodeId: node.node_id
    })}\n\n`));

    // Store response in variable if configured
    if (options.storeResponseAs) {
      context.variables[options.storeResponseAs] = response;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'variable_update',
        variable: options.storeResponseAs,
        value: response
      })}\n\n`));
    }
  } catch (error) {
    console.error('AI response error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI response';
    
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'message',
      content: `Error: ${errorMessage}`,
      nodeId: node.node_id
    })}\n\n`));
    
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'backend_log',
      content: `AI Error: ${errorMessage}`,
      data: { error: errorMessage }
    })}\n\n`));
  }
}

function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? String(variables[varName]) : match;
  });
}