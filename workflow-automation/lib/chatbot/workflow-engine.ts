import { getServiceSupabase } from '@/lib/supabase/client';
import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { decrypt } from '@/lib/utils/encryption';

interface WorkflowContext {
  userId: string;
  contactId: string;
  contactData?: any;
  sessionVariables?: Record<string, any>;
}

interface WorkflowAction {
  type: 'add_tag' | 'remove_tag' | 'send_webhook' | 'update_contact' | 'create_opportunity' | 'send_sms' | 'send_email';
  data: Record<string, any>;
}

interface WorkflowCheckpoint {
  id: string;
  checkpoint_key: string;
  checkpoint_type: 'question' | 'condition' | 'action' | 'end';
  title: string;
  content?: string;
  conditions: any[];
  actions: WorkflowAction[];
  next_checkpoint_key?: string;
}

export class WorkflowEngine {
  private supabase = getServiceSupabase();

  /**
   * Check if a contact has tags that should trigger workflows
   */
  async checkAndTriggerWorkflows(userId: string, contactId: string, contactTags: string[]) {
    try {
      // Find active workflows that match any of the contact's tags
      const { data: workflows, error } = await this.supabase
        .from('chatbot_workflows')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('trigger_tag', contactTags);

      if (error) {
        console.error('Error fetching workflows:', error);
        return [];
      }

      const triggeredWorkflows = [];

      for (const workflow of workflows || []) {
        // Check if there's already an active session for this workflow
        const { data: existingSession } = await this.supabase
          .from('conversation_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('ghl_contact_id', contactId)
          .eq('workflow_id', workflow.id)
          .eq('is_active', true)
          .single();

        if (!existingSession) {
          // Create new conversation session
          const session = await this.createConversationSession(userId, contactId, workflow.id);
          if (session) {
            triggeredWorkflows.push({
              workflow,
              session
            });
          }
        }
      }

      return triggeredWorkflows;

    } catch (error) {
      console.error('Error in checkAndTriggerWorkflows:', error);
      return [];
    }
  }

  /**
   * Create a new conversation session
   */
  private async createConversationSession(userId: string, contactId: string, workflowId: string) {
    try {
      const { data: session, error } = await this.supabase
        .from('conversation_sessions')
        .insert([{
          user_id: userId,
          ghl_contact_id: contactId,
          workflow_id: workflowId,
          current_checkpoint_key: 'start',
          session_data: {},
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation session:', error);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error in createConversationSession:', error);
      return null;
    }
  }

  /**
   * Process a message within a workflow context
   */
  async processWorkflowMessage(sessionId: string, userMessage: string): Promise<string | null> {
    try {
      // Get session and workflow data
      const { data: session, error: sessionError } = await this.supabase
        .from('conversation_sessions')
        .select(`
          *,
          chatbot_workflows (
            *,
            workflow_checkpoints (*)
          )
        `)
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        console.error('Session not found:', sessionError);
        return null;
      }

      // Log user message
      await this.logMessage(sessionId, 'user', userMessage);

      // Get current checkpoint
      const workflow = session.chatbot_workflows;
      const currentCheckpoint = workflow.workflow_checkpoints.find(
        (cp: any) => cp.checkpoint_key === session.current_checkpoint_key
      );

      if (!currentCheckpoint) {
        console.error('Current checkpoint not found:', session.current_checkpoint_key);
        return 'I encountered an error processing your message. Please try again.';
      }

      // Process the checkpoint
      const response = await this.processCheckpoint(session, currentCheckpoint, userMessage);

      // Log bot response
      if (response) {
        await this.logMessage(sessionId, 'bot', response, currentCheckpoint.checkpoint_key);
      }

      return response;

    } catch (error) {
      console.error('Error in processWorkflowMessage:', error);
      return 'I encountered an error processing your message. Please try again.';
    }
  }

  /**
   * Process a specific checkpoint in the workflow
   */
  private async processCheckpoint(session: any, checkpoint: WorkflowCheckpoint, userMessage?: string): Promise<string> {
    const context: WorkflowContext = {
      userId: session.user_id,
      contactId: session.ghl_contact_id,
      sessionVariables: session.session_data || {}
    };

    switch (checkpoint.checkpoint_type) {
      case 'question':
        return this.processQuestionCheckpoint(session, checkpoint, userMessage);

      case 'condition':
        return this.processConditionCheckpoint(session, checkpoint, userMessage);

      case 'action':
        return this.processActionCheckpoint(session, checkpoint, context);

      case 'end':
        await this.endConversationSession(session.id);
        return checkpoint.content || 'Thank you for your time. This conversation has ended.';

      default:
        return 'I encountered an unexpected checkpoint type. Please contact support.';
    }
  }

  /**
   * Process a question checkpoint
   */
  private async processQuestionCheckpoint(session: any, checkpoint: WorkflowCheckpoint, userMessage?: string): Promise<string> {
    if (!userMessage) {
      // First time at this checkpoint, ask the question
      return checkpoint.content || 'Please provide your response.';
    }

    // Store the user's response in session data
    const sessionData = { ...session.session_data };
    sessionData[`response_${checkpoint.checkpoint_key}`] = userMessage;

    await this.updateSessionData(session.id, sessionData);

    // Move to next checkpoint if specified
    if (checkpoint.next_checkpoint_key) {
      await this.updateCurrentCheckpoint(session.id, checkpoint.next_checkpoint_key);
      
      // Get next checkpoint and process it
      const workflow = session.chatbot_workflows;
      const nextCheckpoint = workflow.workflow_checkpoints.find(
        (cp: any) => cp.checkpoint_key === checkpoint.next_checkpoint_key
      );

      if (nextCheckpoint) {
        return this.processCheckpoint(session, nextCheckpoint);
      }
    }

    return 'Thank you for your response. What would you like to do next?';
  }

  /**
   * Process a condition checkpoint (branching logic)
   */
  private async processConditionCheckpoint(session: any, checkpoint: WorkflowCheckpoint, userMessage?: string): Promise<string> {
    // Evaluate conditions to determine next checkpoint
    for (const condition of checkpoint.conditions || []) {
      if (await this.evaluateCondition(condition, userMessage, session.session_data)) {
        // Move to the specified next checkpoint
        await this.updateCurrentCheckpoint(session.id, condition.next_checkpoint_key);
        
        // Get and process the next checkpoint
        const workflow = session.chatbot_workflows;
        const nextCheckpoint = workflow.workflow_checkpoints.find(
          (cp: any) => cp.checkpoint_key === condition.next_checkpoint_key
        );

        if (nextCheckpoint) {
          return this.processCheckpoint(session, nextCheckpoint, userMessage);
        }
      }
    }

    // If no conditions match, use default next checkpoint
    if (checkpoint.next_checkpoint_key) {
      await this.updateCurrentCheckpoint(session.id, checkpoint.next_checkpoint_key);
      
      const workflow = session.chatbot_workflows;
      const nextCheckpoint = workflow.workflow_checkpoints.find(
        (cp: any) => cp.checkpoint_key === checkpoint.next_checkpoint_key
      );

      if (nextCheckpoint) {
        return this.processCheckpoint(session, nextCheckpoint, userMessage);
      }
    }

    return 'I need more information to continue. Could you please clarify your request?';
  }

  /**
   * Process an action checkpoint
   */
  private async processActionCheckpoint(session: any, checkpoint: WorkflowCheckpoint, context: WorkflowContext): Promise<string> {
    let results = [];

    // Execute all actions for this checkpoint
    for (const action of checkpoint.actions || []) {
      const result = await this.executeAction(session.id, action, context);
      results.push(result);
    }

    // Move to next checkpoint if specified
    if (checkpoint.next_checkpoint_key) {
      await this.updateCurrentCheckpoint(session.id, checkpoint.next_checkpoint_key);
    }

    return checkpoint.content || 'Actions completed successfully.';
  }

  /**
   * Execute a specific action
   */
  private async executeAction(sessionId: string, action: WorkflowAction, context: WorkflowContext): Promise<boolean> {
    try {
      // Log the action
      const { data: actionLog, error: logError } = await this.supabase
        .from('workflow_actions')
        .insert([{
          session_id: sessionId,
          action_type: action.type,
          action_data: action.data,
          status: 'pending'
        }])
        .select()
        .single();

      if (logError) {
        console.error('Error logging action:', logError);
        return false;
      }

      let success = false;

      switch (action.type) {
        case 'add_tag':
          success = await this.addTagToContact(context, action.data.tag);
          break;

        case 'remove_tag':
          success = await this.removeTagFromContact(context, action.data.tag);
          break;

        case 'send_webhook':
          success = await this.sendWebhook(action.data.url, action.data.payload || {});
          break;

        case 'update_contact':
          success = await this.updateContact(context, action.data);
          break;

        default:
          console.warn('Unknown action type:', action.type);
          success = false;
      }

      // Update action status
      await this.supabase
        .from('workflow_actions')
        .update({ 
          status: success ? 'completed' : 'failed',
          ...(success ? {} : { error_message: 'Action execution failed' })
        })
        .eq('id', actionLog.id);

      return success;

    } catch (error) {
      console.error('Error executing action:', error);
      return false;
    }
  }

  /**
   * Helper methods for specific actions
   */
  private async addTagToContact(context: WorkflowContext, tag: string): Promise<boolean> {
    // Implementation would use GHL MCP client to add tag
    // For now, return true as placeholder
    console.log(`Adding tag "${tag}" to contact ${context.contactId}`);
    return true;
  }

  private async removeTagFromContact(context: WorkflowContext, tag: string): Promise<boolean> {
    console.log(`Removing tag "${tag}" from contact ${context.contactId}`);
    return true;
  }

  private async sendWebhook(url: string, payload: any): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (error) {
      console.error('Webhook failed:', error);
      return false;
    }
  }

  private async updateContact(context: WorkflowContext, updateData: any): Promise<boolean> {
    console.log(`Updating contact ${context.contactId} with:`, updateData);
    return true;
  }

  /**
   * Evaluate a condition for branching logic
   */
  private async evaluateCondition(condition: any, userMessage: string = '', sessionData: any = {}): Promise<boolean> {
    switch (condition.type) {
      case 'contains_keyword':
        return userMessage.toLowerCase().includes(condition.value.toLowerCase());

      case 'regex_match':
        const regex = new RegExp(condition.value, 'i');
        return regex.test(userMessage);

      case 'session_variable':
        return sessionData[condition.variable] === condition.value;

      default:
        return false;
    }
  }

  /**
   * Helper methods for session management
   */
  private async logMessage(sessionId: string, messageType: 'user' | 'bot' | 'system', content: string, checkpointKey?: string) {
    await this.supabase
      .from('conversation_messages')
      .insert([{
        session_id: sessionId,
        message_type: messageType,
        content,
        checkpoint_key: checkpointKey
      }]);
  }

  private async updateSessionData(sessionId: string, sessionData: any) {
    await this.supabase
      .from('conversation_sessions')
      .update({ 
        session_data: sessionData,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  private async updateCurrentCheckpoint(sessionId: string, checkpointKey: string) {
    await this.supabase
      .from('conversation_sessions')
      .update({ 
        current_checkpoint_key: checkpointKey,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  private async endConversationSession(sessionId: string) {
    await this.supabase
      .from('conversation_sessions')
      .update({ 
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }
}