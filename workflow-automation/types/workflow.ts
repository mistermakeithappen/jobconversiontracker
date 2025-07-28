export interface User {
  id: string;
  clerk_id: string;
  email: string;
  created_at: string;
  subscription_status: 'active' | 'inactive' | 'past_due' | 'cancelled';
  stripe_customer_id?: string;
  credits_remaining: number;
  credits_reset_at?: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  execution_count: number;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'loop';
  position: { x: number; y: number };
  data: {
    label: string;
    integration: string;
    action: string;
    config: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  value?: any;
  source?: string; // Node ID that sets this variable
}

export interface Execution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  logs: ExecutionLog[];
  error?: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  credits_used: number;
}

export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  node_id?: string;
  data?: Record<string, any>;
}

export interface Integration {
  id: string;
  user_id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  definition: WorkflowDefinition;
  preview_image_url?: string;
  use_count: number;
  created_at: string;
  is_featured: boolean;
}