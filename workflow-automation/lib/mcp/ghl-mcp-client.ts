import { createClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface GHLMCPConfig {
  url: string;
  token: string;
  locationId: string;
}

export class GHLMCPClient {
  private client: any;
  private config: GHLMCPConfig;
  private connected: boolean = false;

  constructor(config: GHLMCPConfig) {
    this.config = config;
  }

  async connect() {
    try {
      // For HTTP-based MCP servers, we'll use fetch directly
      // MCP over HTTP is still experimental, so we'll implement a custom client
      this.connected = true;
      console.log('GHL MCP Client connected');
    } catch (error) {
      console.error('Failed to connect to GHL MCP:', error);
      throw error;
    }
  }

  async disconnect() {
    this.connected = false;
  }

  // MCP Methods
  async listTools() {
    if (!this.connected) throw new Error('MCP client not connected');
    
    // Official GoHighLevel MCP Server - Top 21 tools
    return {
      tools: [
        // Calendar Tools
        { name: 'calendars_get-calendar-events', description: 'Get calendar events using userId, groupId, or calendarId' },
        { name: 'calendars_get-appointment-notes', description: 'Retrieve notes for a specific appointment' },
        
        // Contact Tools
        { name: 'contacts_get-all-tasks', description: 'Retrieve all tasks for a contact' },
        { name: 'contacts_add-tags', description: 'Add tags to a contact' },
        { name: 'contacts_remove-tags', description: 'Remove tags from a contact' },
        { name: 'contacts_get-contact', description: 'Fetch contact details' },
        { name: 'contacts_update-contact', description: 'Update a contact' },
        { name: 'contacts_upsert-contact', description: 'Update or create a contact' },
        { name: 'contacts_create-contact', description: 'Create a new contact' },
        { name: 'contacts_get-contacts', description: 'Fetch all contacts' },
        
        // Conversation Tools
        { name: 'conversations_search-conversation', description: 'Search/filter/sort conversations' },
        { name: 'conversations_get-messages', description: 'Retrieve messages by conversation ID' },
        { name: 'conversations_send-a-new-message', description: 'Send a message to a conversation thread' },
        
        // Location Tools
        { name: 'locations_get-location', description: 'Get location details by ID' },
        { name: 'locations_get-custom-fields', description: 'Retrieve custom field definitions for a location' },
        
        // Opportunity Tools
        { name: 'opportunities_search-opportunity', description: 'Search for opportunities by criteria' },
        { name: 'opportunities_get-opportunity', description: 'Get a specific opportunity by ID' },
        { name: 'opportunities_update-opportunity', description: 'Update an opportunity' },
        { name: 'opportunities_get-pipelines', description: 'Retrieve all pipelines for the location' },
        
        // Payment Tools
        { name: 'payments_get-order-by-id', description: 'Get order details by ID' },
        { name: 'payments_list-transactions', description: 'List payment transactions' }
      ]
    };
  }

  async listResources() {
    if (!this.connected) throw new Error('MCP client not connected');
    
    // Return empty resources for now
    return { resources: [] };
  }

  async listPrompts() {
    if (!this.connected) throw new Error('MCP client not connected');
    
    // Return empty prompts for now
    return { prompts: [] };
  }

  async callTool(name: string, args: Record<string, any>) {
    if (!this.connected) throw new Error('MCP client not connected');
    
    const response = await this.makeRequest(name, args);
    return response;
  }

  async readResource(uri: string) {
    if (!this.connected) throw new Error('MCP client not connected');
    
    // Resources not supported in GHL MCP format yet
    throw new Error('Resources not supported by GoHighLevel MCP server');
  }

  async getPrompt(name: string, args?: Record<string, any>) {
    if (!this.connected) throw new Error('MCP client not connected');
    
    // Prompts not supported in GHL MCP format yet
    throw new Error('Prompts not supported by GoHighLevel MCP server');
  }

  // GoHighLevel specific helper methods

  // Calendar Tools
  async getCalendarEvents(params: { userId?: string; groupId?: string; calendarId?: string; startDate?: string; endDate?: string }) {
    return this.callTool('calendars_get-calendar-events', params);
  }

  async getAppointmentNotes(appointmentId: string) {
    return this.callTool('calendars_get-appointment-notes', { appointmentId });
  }

  // Contact Tools
  async getContacts(params?: { limit?: number; offset?: number; query?: string }) {
    // GoHighLevel MCP contacts_get-contacts doesn't support query parameter
    // Only limit and offset are supported
    const requestParams: any = {};
    if (params?.limit) requestParams.limit = params.limit;
    if (params?.offset) requestParams.offset = params.offset;
    
    console.log('🔍 getContacts called with params:', requestParams);
    return this.callTool('contacts_get-contacts', requestParams);
  }

  async getContact(contactId: string) {
    return this.callTool('contacts_get-contact', { contactId });
  }

  async getAllTasks(contactId: string) {
    return this.callTool('contacts_get-all-tasks', { contactId });
  }

  async createContact(contactData: Record<string, any>) {
    return this.callTool('contacts_create-contact', contactData);
  }

  async updateContact(contactId: string, updates: Record<string, any>) {
    return this.callTool('contacts_update-contact', { contactId, ...updates });
  }

  async upsertContact(contactData: Record<string, any>) {
    return this.callTool('contacts_upsert-contact', contactData);
  }

  async addTags(contactId: string, tags: string[]) {
    return this.callTool('contacts_add-tags', { contactId, tags });
  }

  async removeTags(contactId: string, tags: string[]) {
    return this.callTool('contacts_remove-tags', { contactId, tags });
  }

  async getOpportunities(params?: { pipelineId?: string; stageId?: string; limit?: number }) {
    // Use search opportunity since there's no direct "get opportunities" tool
    return this.callTool('opportunities_search-opportunity', params || {});
  }

  async getOpportunity(opportunityId: string) {
    return this.callTool('opportunities_get-opportunity', { opportunityId });
  }

  async searchOpportunity(params: { 
    query?: string; 
    pipelineId?: string; 
    stageId?: string;
    contactId?: string;
    status?: string;
    limit?: number; 
    offset?: number;
  }) {
    return this.callTool('opportunities_search-opportunity', params);
  }

  async updateOpportunity(opportunityId: string, updates: Record<string, any>) {
    return this.callTool('opportunities_update-opportunity', { opportunityId, ...updates });
  }

  async getPipelines() {
    // Based on GHL MCP docs, pipelines might be under opportunities
    return this.callTool('opportunities_get-pipelines', {});
  }

  async getLocation(locationId?: string) {
    const id = locationId || this.config.locationId;
    return this.callTool('locations_get-location', { locationId: id });
  }

  async getCustomFields(locationId?: string) {
    const id = locationId || this.config.locationId;
    return this.callTool('locations_get-custom-fields', { locationId: id });
  }
  
  // Payment Tools
  async listTransactions(params?: { contactId?: string; status?: string }) {
    // Use the official payments_list-transactions tool
    return this.callTool('payments_list-transactions', params || {});
  }
  
  async getOrderById(orderId: string) {
    return this.callTool('payments_get-order-by-id', { orderId });
  }


  // Get all official 21 MCP tools for verification
  getOfficialTools() {
    return [
      'calendars_get-calendar-events',
      'calendars_get-appointment-notes', 
      'contacts_get-all-tasks',
      'contacts_add-tags',
      'contacts_remove-tags',
      'contacts_get-contact', 
      'contacts_update-contact',
      'contacts_upsert-contact',
      'contacts_create-contact',
      'contacts_get-contacts',
      'conversations_search-conversation',
      'conversations_get-messages', 
      'conversations_send-a-new-message',
      'locations_get-location',
      'locations_get-custom-fields',
      'opportunities_search-opportunity',
      'opportunities_get-pipelines',
      'opportunities_get-opportunity', 
      'opportunities_update-opportunity',
      'payments_get-order-by-id',
      'payments_list-transactions'
    ];
  }

  async getCalendars() {
    // Note: Not in official 21 tools - may need custom implementation
    return this.callTool('calendars_get-calendars', {});
  }

  async getAppointments(params?: { calendarId?: string; startDate?: string; endDate?: string }) {
    // Use calendar events instead - part of official 21 tools
    return this.getCalendarEvents(params || {});
  }

  async createAppointment(appointmentData: Record<string, any>) {
    // Note: Not in official 21 tools - may need custom implementation
    return this.callTool('calendars_create-appointment', appointmentData);
  }

  async sendSMS(to: string, message: string) {
    // Use send message instead - part of official 21 tools
    return this.sendMessage(to, message, 'SMS');
  }

  async sendEmail(emailData: { to: string; subject: string; body: string; from?: string }) {
    // Use send message instead - part of official 21 tools  
    return this.sendMessage(emailData.to, `Subject: ${emailData.subject}\n\n${emailData.body}`, 'Email');
  }

  async getConversations(params?: { contactId?: string; limit?: number }) {
    // Try conversations_get-conversations first, fallback to search if needed
    try {
      return this.callTool('conversations_get-conversations', params || {});
    } catch (error) {
      // Fallback to search conversation if get-conversations doesn't exist
      return this.searchConversation(params || {});
    }
  }

  async searchConversation(params: { query?: string; contactId?: string; limit?: number; offset?: number }) {
    return this.callTool('conversations_search-conversation', params);
  }

  async getMessages(conversationId: string, params?: { limit?: number }) {
    return this.callTool('conversations_get-messages', { conversationId, ...params });
  }

  async sendMessage(conversationId: string, message: string, type: 'SMS' | 'Email' = 'SMS', contactId?: string) {
    // GoHighLevel MCP uses specific parameter names with body_ prefix
    const params: any = { 
      body_type: type,
      body_message: message
    };
    
    // Contact ID is required and uses body_ prefix
    if (contactId) {
      params.body_contactId = contactId;
    }
    
    // ConversationId might be body_conversationId or body_threadId
    if (conversationId && conversationId !== contactId) {
      params.body_threadId = conversationId;
    }
    
    return this.callTool('conversations_send-a-new-message', params);
  }

  // Payment Tools (part of official 21 tools)
  async getOrderById(orderId: string) {
    return this.callTool('payments_get-order-by-id', { orderId });
  }

  async listTransactions(params?: { limit?: number; offset?: number; startDate?: string; endDate?: string }) {
    return this.callTool('payments_list-transactions', params || {});
  }

  async createTask(taskData: Record<string, any>) {
    // Note: Not in official 21 tools - may need custom implementation
    return this.callTool('tasks_create-task', taskData);
  }

  async getWorkflows() {
    return this.callTool('workflows_get-workflows', {});
  }

  async triggerWorkflow(workflowId: string, contactId: string) {
    // Note: Not in official 21 tools - may need custom implementation
    return this.callTool('workflows_trigger-workflow', { workflowId, contactId });
  }

  // Private helper method to make HTTP requests to the MCP server
  private async makeRequest(tool: string, input: Record<string, any>) {
    // Use JSON-RPC 2.0 format as expected by GoHighLevel MCP server
    const requestBody = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: tool,
        arguments: input
      },
      id: Date.now()
    };
    
    console.log('🚀 MCP Request:', {
      tool,
      input,
      url: this.config.url,
      locationId: this.config.locationId
    });

    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${this.config.token}`,
        'locationId': this.config.locationId
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP request failed (${response.status}): ${response.statusText} - ${errorText}`);
    }

    // Check if response is Server-Sent Events or JSON
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/event-stream')) {
      // Handle Server-Sent Events response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let finalData = null;
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          result += chunk;
          
          // Look for JSON data in the stream
          const lines = result.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.substring(6).trim();
              if (jsonStr && jsonStr !== '[DONE]') {
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.error) {
                    throw new Error(`MCP error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
                  }
                  // Store the latest valid data
                  finalData = parsed.result || parsed;
                } catch (parseError) {
                  // Continue reading if we can't parse this chunk
                  continue;
                }
              }
            }
          }
        }
      }
      
      if (finalData) {
        console.log('🔍 SSE: Raw finalData structure:', JSON.stringify(finalData, null, 2).substring(0, 500));
        
        // Handle GoHighLevel MCP's nested response format for SSE
        if (finalData && finalData.content && Array.isArray(finalData.content)) {
          console.log('🔍 SSE: Found content array, processing...');
          for (const item of finalData.content) {
            if (item.type === 'text' && item.text) {
              try {
                console.log('🔍 SSE: Parsing first level text:', item.text.substring(0, 200));
                const parsedText = JSON.parse(item.text);
                
                // Check if this is another nested content structure
                if (parsedText.content && Array.isArray(parsedText.content)) {
                  console.log('🔍 SSE: Found nested content, going deeper...');
                  for (const nestedItem of parsedText.content) {
                    if (nestedItem.type === 'text' && nestedItem.text) {
                      try {
                        console.log('🔍 SSE: Parsing second level text:', nestedItem.text.substring(0, 200));
                        const deepParsed = JSON.parse(nestedItem.text);
                        if (deepParsed.success && deepParsed.data) {
                          console.log('✅ SSE: Found actual data at second level!');
                          return deepParsed.data.contacts || deepParsed.data || deepParsed;
                        }
                      } catch (deepParseError) {
                        console.log('❌ SSE: Deep parse error:', deepParseError.message);
                        continue;
                      }
                    }
                  }
                }
                
                // Check first level as well
                if (parsedText.success && parsedText.data) {
                  console.log('✅ SSE: Found actual data at first level!');
                  return parsedText.data.contacts || parsedText.data || parsedText;
                }
              } catch (parseError) {
                console.log('❌ SSE: Parse error:', parseError.message);
                continue;
              }
            }
          }
        }
        console.log('🔍 SSE: Returning original finalData');
        return finalData;
      } else {
        throw new Error('No valid JSON data found in SSE stream');
      }
    } else {
      // Handle regular JSON response
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      // Return the result from JSON-RPC response
      let result = data.result || data;
      
      console.log('🔍 Raw MCP response structure:', JSON.stringify(result, null, 2).substring(0, 500));
      
      // Handle GoHighLevel MCP's nested response format - multiple levels deep
      if (result && result.content && Array.isArray(result.content)) {
        console.log('🔍 Found content array, processing...');
        // Extract the actual data from the nested content structure
        for (const item of result.content) {
          if (item.type === 'text' && item.text) {
            try {
              console.log('🔍 Parsing first level text:', item.text.substring(0, 200));
              const parsedText = JSON.parse(item.text);
              
              // Check if this is another nested content structure
              if (parsedText.content && Array.isArray(parsedText.content)) {
                console.log('🔍 Found nested content, going deeper...');
                for (const nestedItem of parsedText.content) {
                  if (nestedItem.type === 'text' && nestedItem.text) {
                    try {
                      console.log('🔍 Parsing second level text:', nestedItem.text.substring(0, 200));
                      const deepParsed = JSON.parse(nestedItem.text);
                      if (deepParsed.success && deepParsed.data) {
                        console.log('✅ Found actual data at second level!');
                        return deepParsed.data.contacts || deepParsed.data || deepParsed;
                      }
                    } catch (deepParseError) {
                      console.log('❌ Deep parse error:', deepParseError.message);
                      continue;
                    }
                  }
                }
              }
              
              // Check first level as well
              if (parsedText.success && parsedText.data) {
                console.log('✅ Found actual data at first level!');
                return parsedText.data.contacts || parsedText.data || parsedText;
              }
            } catch (parseError) {
              console.log('❌ Parse error:', parseError.message);
              continue;
            }
          }
        }
      }
      
      console.log('🔍 Returning original result');
      return result;
    }
  }
}

// Factory function to create MCP client from integration config
export async function createGHLMCPClient(integrationConfig: any): Promise<GHLMCPClient | null> {
  // Check if MCP credentials are available
  const mcpToken = integrationConfig.mcpToken || process.env.GHL_MCP_TOKEN;
  const locationId = integrationConfig.locationId;
  
  if (!mcpToken || !locationId) {
    console.log('MCP credentials not available, falling back to REST API');
    return null;
  }

  const client = new GHLMCPClient({
    url: process.env.GHL_MCP_URL || 'https://services.leadconnectorhq.com/mcp/',
    token: mcpToken,
    locationId
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to create GHL MCP client:', error);
    return null;
  }
}