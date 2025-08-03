import { getServiceSupabase } from '@/lib/supabase/client';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { AIReasoningEngine } from './reasoning-engine';
import { AppointmentBookingModule } from './appointment-booking';
import { ApiKeyManager } from '@/lib/utils/api-key-manager';

interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_id: string;
  node_type: 'start' | 'milestone' | 'book_appointment' | 'message' | 'condition' | 'action' | 'end';
  title: string;
  description?: string;
  goal_description?: string;
  possible_outcomes?: string[];
  calendar_ids?: string[];
  position_x: number;
  position_y: number;
  config: any;
  actions: any[];
}

interface WorkflowConnection {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: 'standard' | 'conditional' | 'goal_achieved' | 'goal_not_achieved';
  condition?: any;
  label?: string;
}

interface WorkflowContext {
  bot: any;
  userId: string;
  contactId: string;
  contactData?: any;
  sessionVariables: Record<string, any>;
  conversationHistory: Message[];
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ProcessingResult {
  response: string;
  nextNodeId?: string;
  actionsToExecute: any[];
  sessionDataUpdates: Record<string, any>;
  goalEvaluation?: any;
}

export class AdvancedWorkflowEngine {
  private supabase = getServiceSupabase();
  private reasoningEngine?: AIReasoningEngine;
  private appointmentModule?: AppointmentBookingModule;
  private mcpClient?: any;

  /**
   * Initialize the workflow engine with necessary clients
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Get OpenAI API key
      const openAIKey = await ApiKeyManager.getApiKey(userId, 'openai');
      if (openAIKey) {
        this.reasoningEngine = new AIReasoningEngine(openAIKey);
        this.appointmentModule = new AppointmentBookingModule(openAIKey);
      }

      // Get GHL MCP client
      const { data: integration } = await this.supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'gohighlevel')
        .eq('is_active', true)
        .single();

      if (integration) {
        const mcpToken = await ApiKeyManager.getApiKey(userId, 'ghlmcp');
        if (mcpToken) {
          this.mcpClient = await createGHLMCPClient({
            mcpToken,
            locationId: integration.config?.locationId
          });
        }
      }
    } catch (error) {
      console.error('Error initializing workflow engine:', error);
    }
  }

  /**
   * Process a message within a bot conversation
   */
  async processBotMessage(
    botId: string,
    contactId: string,
    userMessage: string,
    sessionId?: string
  ): Promise<{ response: string; sessionId: string }> {
    try {
      // Get bot configuration
      const { data: bot, error: botError } = await this.supabase
        .from('bots')
        .select(`
          *,
          bot_workflows (
            workflow_id,
            is_primary,
            priority,
            chatbot_workflows (*)
          )
        `)
        .eq('id', botId)
        .eq('is_active', true)
        .single();

      if (botError || !bot) {
        return {
          response: 'I apologize, but I am currently unavailable. Please try again later.',
          sessionId: ''
        };
      }

      // Initialize engine if needed
      if (!this.reasoningEngine) {
        await this.initialize(bot.user_id);
      }

      // Get or create conversation session
      let session = sessionId ? await this.getSession(sessionId) : null;
      
      if (!session) {
        // Check for active workflows based on contact tags
        const workflow = await this.selectWorkflowForContact(bot, contactId);
        if (workflow) {
          session = await this.createSession(bot.user_id, bot.id, contactId, workflow.id);
        } else {
          // No workflow triggered, use general conversation
          return {
            response: await this.generateGeneralResponse(bot, userMessage, []),
            sessionId: ''
          };
        }
      }

      // Process the message through the workflow
      const result = await this.processWorkflowMessage(session, userMessage, bot);

      // Update session with any changes
      await this.updateSession(session.id, result);

      return {
        response: result.response,
        sessionId: session.id
      };

    } catch (error) {
      console.error('Error processing bot message:', error);
      return {
        response: 'I encountered an error processing your message. Please try again.',
        sessionId: sessionId || ''
      };
    }
  }

  /**
   * Process a message within a workflow
   */
  private async processWorkflowMessage(
    session: any,
    userMessage: string,
    bot: any
  ): Promise<ProcessingResult> {
    try {
      // Log user message
      await this.logMessage(session.id, 'user', userMessage);

      // Get current node and workflow structure
      const { nodes, connections } = await this.getWorkflowStructure(session.workflow_id);
      const currentNode = nodes.find(n => n.node_id === session.current_checkpoint_key);

      if (!currentNode) {
        return {
          response: 'I seem to have lost track of our conversation. Let me start over.',
          actionsToExecute: [],
          sessionDataUpdates: {}
        };
      }

      // Get conversation history
      const conversationHistory = await this.getConversationHistory(session.id);

      // Build context
      const context: WorkflowContext = {
        bot,
        userId: session.user_id,
        contactId: session.ghl_contact_id,
        sessionVariables: session.session_data || {},
        conversationHistory
      };

      // Process based on node type
      let result: ProcessingResult;

      switch (currentNode.node_type) {
        case 'milestone':
          result = await this.processMilestoneNode(currentNode, userMessage, context, connections);
          break;

        case 'book_appointment':
          result = await this.processAppointmentNode(currentNode, userMessage, context, session.id);
          break;

        case 'message':
          result = await this.processMessageNode(currentNode, userMessage, context, connections);
          break;

        case 'condition':
          result = await this.processConditionNode(currentNode, userMessage, context, connections);
          break;

        case 'action':
          result = await this.processActionNode(currentNode, context, connections);
          break;

        case 'end':
          result = await this.processEndNode(currentNode, context);
          break;

        default:
          result = {
            response: 'I encountered an unexpected situation. Please contact support.',
            actionsToExecute: [],
            sessionDataUpdates: {}
          };
      }

      // Execute any actions
      for (const action of result.actionsToExecute) {
        await this.executeAction(session.id, action, context);
      }

      // Log bot response
      await this.logMessage(session.id, 'assistant', result.response, currentNode.node_id);

      return result;

    } catch (error) {
      console.error('Error in processWorkflowMessage:', error);
      return {
        response: 'I encountered an error. Please try again.',
        actionsToExecute: [],
        sessionDataUpdates: {}
      };
    }
  }

  /**
   * Process a milestone node with goal evaluation
   */
  private async processMilestoneNode(
    node: WorkflowNode,
    userMessage: string,
    context: WorkflowContext,
    connections: WorkflowConnection[]
  ): Promise<ProcessingResult> {
    if (!this.reasoningEngine) {
      return {
        response: 'I need to be configured with AI capabilities to continue.',
        actionsToExecute: [],
        sessionDataUpdates: {}
      };
    }

    // Evaluate if the goal has been achieved
    const evaluation = await this.reasoningEngine.evaluateGoalAchievement({
      goal: node.goal_description || '',
      possibleOutcomes: node.possible_outcomes || [],
      userMessage,
      conversationHistory: context.conversationHistory,
      botContext: context.bot.specific_context,
      sessionData: context.sessionVariables
    });

    // Log the evaluation
    await this.reasoningEngine.logEvaluation(
      context.sessionVariables.sessionId,
      node.id,
      userMessage,
      evaluation
    );

    // Extract any data from the conversation
    if (evaluation.extractedData) {
      Object.assign(context.sessionVariables, evaluation.extractedData);
    }

    // Determine next node based on goal achievement
    let nextNodeId: string | undefined;
    const actionsToExecute = [...(node.actions || [])];

    if (evaluation.achieved && evaluation.confidence >= 70) {
      // Goal achieved - find goal_achieved connection
      const successConnection = connections.find(
        c => c.source_node_id === node.node_id && c.connection_type === 'goal_achieved'
      );
      nextNodeId = successConnection?.target_node_id;

      // Add any success actions
      if (node.config?.successActions) {
        actionsToExecute.push(...node.config.successActions);
      }
    } else {
      // Goal not achieved - stay at current node or follow goal_not_achieved path
      const failureConnection = connections.find(
        c => c.source_node_id === node.node_id && c.connection_type === 'goal_not_achieved'
      );
      
      if (failureConnection && evaluation.confidence >= 70) {
        // High confidence that goal is NOT achieved, move to failure path
        nextNodeId = failureConnection.target_node_id;
      }
      // Otherwise, stay at current node and keep trying
    }

    // Use suggested response or generate one
    const response = evaluation.suggestedResponse || 
      await this.generateNodeResponse(node, context);

    return {
      response,
      nextNodeId,
      actionsToExecute,
      sessionDataUpdates: context.sessionVariables,
      goalEvaluation: evaluation
    };
  }

  /**
   * Process an appointment booking node
   */
  private async processAppointmentNode(
    node: WorkflowNode,
    userMessage: string,
    context: WorkflowContext,
    sessionId: string
  ): Promise<ProcessingResult> {
    if (!this.appointmentModule || !this.mcpClient) {
      return {
        response: 'I apologize, but appointment booking is not currently available.',
        actionsToExecute: [],
        sessionDataUpdates: {}
      };
    }

    const bookingResult = await this.appointmentModule.processBookingRequest(
      {
        sessionId,
        nodeId: node.id,
        contactId: context.contactId,
        calendarIds: node.calendar_ids || [],
        userMessage,
        conversationHistory: context.conversationHistory,
        timezone: context.contactData?.timezone
      },
      this.mcpClient
    );

    // Determine next node based on booking status
    let nextNodeId: string | undefined;
    if (bookingResult.status === 'confirmed') {
      // Find success connection
      const connections = await this.getNodeConnections(node.workflow_id, node.node_id);
      const successConnection = connections.find(c => c.connection_type === 'goal_achieved');
      nextNodeId = successConnection?.target_node_id;
    }

    return {
      response: bookingResult.message,
      nextNodeId,
      actionsToExecute: bookingResult.success ? node.actions || [] : [],
      sessionDataUpdates: {
        ...context.sessionVariables,
        lastBookingStatus: bookingResult.status,
        appointmentId: bookingResult.appointmentId
      }
    };
  }

  /**
   * Process a simple message node
   */
  private async processMessageNode(
    node: WorkflowNode,
    userMessage: string,
    context: WorkflowContext,
    connections: WorkflowConnection[]
  ): Promise<ProcessingResult> {
    // Store user response
    context.sessionVariables[`response_${node.node_id}`] = userMessage;

    // Find next node
    const nextConnection = connections.find(
      c => c.source_node_id === node.node_id && c.connection_type === 'standard'
    );

    // Generate response
    const response = node.config?.message || node.description || 
      await this.generateNodeResponse(node, context);

    return {
      response,
      nextNodeId: nextConnection?.target_node_id,
      actionsToExecute: node.actions || [],
      sessionDataUpdates: context.sessionVariables
    };
  }

  /**
   * Process a condition node
   */
  private async processConditionNode(
    node: WorkflowNode,
    userMessage: string,
    context: WorkflowContext,
    connections: WorkflowConnection[]
  ): Promise<ProcessingResult> {
    if (!this.reasoningEngine) {
      return {
        response: 'I need AI capabilities to evaluate conditions.',
        actionsToExecute: [],
        sessionDataUpdates: {}
      };
    }

    // Evaluate each condition
    let nextNodeId: string | undefined;

    for (const connection of connections.filter(c => c.source_node_id === node.node_id)) {
      if (connection.condition) {
        const conditionMet = await this.reasoningEngine.evaluateCondition(
          connection.condition,
          userMessage,
          context.conversationHistory,
          context.sessionVariables
        );

        if (conditionMet) {
          nextNodeId = connection.target_node_id;
          break;
        }
      }
    }

    // If no condition matched, use default connection
    if (!nextNodeId) {
      const defaultConnection = connections.find(
        c => c.source_node_id === node.node_id && c.connection_type === 'standard'
      );
      nextNodeId = defaultConnection?.target_node_id;
    }

    // Generate response
    const response = await this.generateNodeResponse(node, context);

    return {
      response,
      nextNodeId,
      actionsToExecute: node.actions || [],
      sessionDataUpdates: context.sessionVariables
    };
  }

  /**
   * Process an action node
   */
  private async processActionNode(
    node: WorkflowNode,
    context: WorkflowContext,
    connections: WorkflowConnection[]
  ): Promise<ProcessingResult> {
    // Find next node
    const nextConnection = connections.find(
      c => c.source_node_id === node.node_id && c.connection_type === 'standard'
    );

    // Generate response
    const response = node.config?.message || 'Processing your request...';

    return {
      response,
      nextNodeId: nextConnection?.target_node_id,
      actionsToExecute: node.actions || [],
      sessionDataUpdates: context.sessionVariables
    };
  }

  /**
   * Process an end node
   */
  private async processEndNode(
    node: WorkflowNode,
    context: WorkflowContext
  ): Promise<ProcessingResult> {
    // Mark session as ended
    await this.endSession(context.sessionVariables.sessionId);

    const response = node.config?.message || node.description || 
      'Thank you for your time. This conversation has ended.';

    return {
      response,
      actionsToExecute: node.actions || [],
      sessionDataUpdates: context.sessionVariables
    };
  }

  /**
   * Helper methods
   */

  private async getWorkflowStructure(workflowId: string) {
    const [nodesResult, connectionsResult] = await Promise.all([
      this.supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflowId),
      this.supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_id', workflowId)
    ]);

    return {
      nodes: nodesResult.data || [],
      connections: connectionsResult.data || []
    };
  }

  private async getNodeConnections(workflowId: string, nodeId: string) {
    const { data } = await this.supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('source_node_id', nodeId);

    return data || [];
  }

  private async getConversationHistory(sessionId: string): Promise<Message[]> {
    const { data } = await this.supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return (data || []).map(msg => ({
      role: msg.message_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  private async generateNodeResponse(
    node: WorkflowNode,
    context: WorkflowContext
  ): Promise<string> {
    if (!this.reasoningEngine) {
      return node.description || 'Please continue...';
    }

    return await this.reasoningEngine.generateResponse(
      node.node_type,
      node.config || {},
      context.conversationHistory,
      context.bot.specific_context,
      context.sessionVariables
    );
  }

  private async generateGeneralResponse(
    bot: any,
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<string> {
    if (!this.reasoningEngine) {
      return 'I apologize, but I need AI capabilities to respond properly.';
    }

    const systemPrompt = `${bot.global_context}\n\n${bot.specific_context}`;
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];

    try {
      const completion = await this.reasoningEngine['openai'].chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message.content || 'I understand. How can I help you?';
    } catch (error) {
      console.error('Error generating general response:', error);
      return 'I apologize, but I encountered an error. Please try again.';
    }
  }

  private async selectWorkflowForContact(bot: any, contactId: string): Promise<any> {
    // In a full implementation, this would check contact tags against workflow triggers
    // For now, return the primary workflow if available
    const primaryWorkflow = bot.bot_workflows?.find((bw: any) => bw.is_primary);
    return primaryWorkflow?.chatbot_workflows;
  }

  private async getSession(sessionId: string) {
    const { data } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('is_active', true)
      .single();

    return data;
  }

  private async createSession(userId: string, botId: string, contactId: string, workflowId: string) {
    const { data } = await this.supabase
      .from('conversation_sessions')
      .insert([{
        user_id: userId,
        bot_id: botId,
        ghl_contact_id: contactId,
        workflow_id: workflowId,
        current_checkpoint_key: 'start',
        session_data: {},
        is_active: true
      }])
      .select()
      .single();

    return data;
  }

  private async updateSession(sessionId: string, result: ProcessingResult) {
    const updates: any = {
      session_data: result.sessionDataUpdates,
      last_activity_at: new Date().toISOString()
    };

    if (result.nextNodeId) {
      updates.current_checkpoint_key = result.nextNodeId;
    }

    await this.supabase
      .from('conversation_sessions')
      .update(updates)
      .eq('id', sessionId);
  }

  private async endSession(sessionId: string) {
    await this.supabase
      .from('conversation_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  private async logMessage(sessionId: string, type: 'user' | 'assistant', content: string, nodeId?: string) {
    await this.supabase
      .from('conversation_messages')
      .insert([{
        session_id: sessionId,
        message_type: type,
        content,
        checkpoint_key: nodeId
      }]);
  }

  private async executeAction(sessionId: string, action: any, context: WorkflowContext) {
    try {
      // Log the action
      await this.supabase
        .from('workflow_actions')
        .insert([{
          session_id: sessionId,
          action_type: action.type,
          action_data: action.data || {},
          status: 'pending'
        }]);

      // Execute based on type
      switch (action.type) {
        case 'add_tag':
          if (this.mcpClient) {
            await this.mcpClient.addTags(context.contactId, [action.data.tag]);
          }
          break;

        case 'send_webhook':
          await fetch(action.data.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...action.data.payload,
              sessionId,
              contactId: context.contactId,
              sessionData: context.sessionVariables
            })
          });
          break;

        // Add more action types as needed
      }
    } catch (error) {
      console.error('Error executing action:', error);
    }
  }
}