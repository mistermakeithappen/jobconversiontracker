import { createClient } from '@supabase/supabase-js';
import { Node, Edge } from 'reactflow';

export interface ExecutionLog {
  timestamp: string;
  nodeId: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  data?: any;
}

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  variables: Record<string, any>;
  logs: ExecutionLog[];
}

export interface NodeExecutor {
  execute(node: Node, context: ExecutionContext): Promise<any>;
}

// Module executors for different integrations
const moduleExecutors: Record<string, NodeExecutor> = {
  'webhook-trigger': {
    async execute(node, context) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        message: 'Webhook trigger executed',
        type: 'info',
        data: { 
          webhookUrl: `/api/webhooks/${context.workflowId}`,
          receivedData: context.variables.webhookData 
        }
      };
      context.logs.push(log);
      return context.variables.webhookData || {};
    }
  },
  'gohighlevel-trigger': {
    async execute(node, context) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        message: `GoHighLevel webhook trigger: ${node.data.selectedOption}`,
        type: 'info',
        data: { 
          webhookUrl: `/api/webhooks/${context.workflowId}`,
          eventType: node.data.selectedOption,
          receivedData: context.variables.webhookData 
        }
      };
      context.logs.push(log);
      return context.variables.webhookData || {};
    }
  },
  'gohighlevel-action': {
    async execute(node, context) {
      // Simulate API call
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        message: `Executing GHL action: ${node.data.selectedOption}`,
        type: 'success',
        data: { action: node.data.selectedOption }
      };
      context.logs.push(log);
      
      // Mock response based on action type
      const mockResponses: Record<string, any> = {
        'create-contact': { contactId: 'mock-contact-123', email: 'new@example.com' },
        'update-contact': { contactId: 'mock-contact-123', updated: true },
        'create-opportunity': { opportunityId: 'mock-opp-456', value: 1000 },
        'send-sms': { messageId: 'mock-msg-789', status: 'sent' },
        'add-tag': { contactId: 'mock-contact-123', tags: ['new-tag'] }
      };
      
      return mockResponses[node.data.selectedOption || ''] || { success: true };
    }
  },
  'openai': {
    async execute(node, context) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        message: 'Processing with OpenAI',
        type: 'info',
        data: { model: 'gpt-4' }
      };
      context.logs.push(log);
      
      // Mock AI response
      return { 
        response: 'AI generated response based on input',
        tokens: 150
      };
    }
  },
  'data-transform': {
    async execute(node, context) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        nodeId: node.id,
        message: 'Transforming data',
        type: 'success'
      };
      context.logs.push(log);
      
      // Mock data transformation
      return {
        transformed: true,
        output: { ...context.variables, transformed: true }
      };
    }
  }
};

export class WorkflowExecutionEngine {
  private supabase: any;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  async executeWorkflow(
    workflowId: string,
    userId: string,
    inputData?: any
  ): Promise<string> {
    // Create execution record
    const { data: execution, error: execError } = await this.supabase
      .from('executions')
      .insert({
        workflow_id: workflowId,
        user_id: userId,
        status: 'running',
        input_data: inputData || {},
        logs: []
      })
      .select()
      .single();
      
    if (execError) {
      throw new Error(`Failed to create execution: ${execError.message}`);
    }
    
    const executionId = execution.id;
    
    try {
      // Get workflow definition
      const { data: workflow, error: workflowError } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();
        
      if (workflowError) {
        throw new Error(`Failed to load workflow: ${workflowError.message}`);
      }
      
      const { nodes, edges } = workflow.definition;
      const context: ExecutionContext = {
        workflowId,
        executionId,
        userId,
        variables: inputData || {},
        logs: []
      };
      
      // Execute nodes in order
      const executionOrder = this.getExecutionOrder(nodes, edges);
      let lastOutput = inputData || {};
      
      for (const nodeId of executionOrder) {
        const node = nodes.find((n: Node) => n.id === nodeId);
        if (!node) continue;
        
        context.variables = { ...context.variables, ...lastOutput };
        
        try {
          const integrationKey = `${node.data.integration}-${node.data.moduleType}`;
          const executor = moduleExecutors[integrationKey] || moduleExecutors[node.data.integration || ''];
          
          if (executor) {
            lastOutput = await executor.execute(node, context);
          } else {
            const log: ExecutionLog = {
              timestamp: new Date().toISOString(),
              nodeId: node.id,
              message: `No executor found for ${node.data.integration}`,
              type: 'warning'
            };
            context.logs.push(log);
          }
        } catch (error: any) {
          const log: ExecutionLog = {
            timestamp: new Date().toISOString(),
            nodeId: node.id,
            message: `Error executing node: ${error.message}`,
            type: 'error'
          };
          context.logs.push(log);
          throw error;
        }
      }
      
      // Update execution as completed
      await this.supabase
        .from('executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          logs: context.logs,
          output_data: lastOutput
        })
        .eq('id', executionId);
        
      // Update workflow stats
      await this.supabase
        .from('workflows')
        .update({
          last_executed_at: new Date().toISOString(),
          execution_count: workflow.execution_count + 1
        })
        .eq('id', workflowId);
        
      return executionId;
      
    } catch (error: any) {
      // Update execution as failed
      await this.supabase
        .from('executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: error.message
        })
        .eq('id', executionId);
        
      throw error;
    }
  }
  
  private getExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
    // Simple topological sort for execution order
    const inDegree: Record<string, number> = {};
    const adjacencyList: Record<string, string[]> = {};
    
    // Initialize
    nodes.forEach(node => {
      inDegree[node.id] = 0;
      adjacencyList[node.id] = [];
    });
    
    // Build graph
    edges.forEach(edge => {
      adjacencyList[edge.source].push(edge.target);
      inDegree[edge.target]++;
    });
    
    // Find nodes with no incoming edges
    const queue: string[] = [];
    Object.keys(inDegree).forEach(nodeId => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    });
    
    const executionOrder: string[] = [];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      executionOrder.push(current);
      
      adjacencyList[current].forEach(neighbor => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    return executionOrder;
  }
  
  async getExecutionStatus(executionId: string) {
    const { data, error } = await this.supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();
      
    if (error) {
      throw new Error(`Failed to get execution status: ${error.message}`);
    }
    
    return data;
  }
  
  async getWorkflowExecutions(workflowId: string, limit: number = 10) {
    const { data, error } = await this.supabase
      .from('executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('started_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      throw new Error(`Failed to get executions: ${error.message}`);
    }
    
    return data;
  }
}