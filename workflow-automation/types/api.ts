// Common API types to replace 'any' usage

export interface APIError {
  error: string;
  message?: string;
  statusCode?: number;
  details?: unknown;
}

export interface APIResponse<T = unknown> {
  data?: T;
  error?: APIError;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// Generic record type for object data
export type GenericRecord = Record<string, unknown>;

// Contact types
export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: GenericRecord;
  dateAdded?: string;
  [key: string]: unknown;
}

// Opportunity types
export interface Opportunity {
  id: string;
  name?: string;
  monetaryValue?: number;
  status?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  customFields?: GenericRecord;
  [key: string]: unknown;
}

// Location types
export interface Location {
  id: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  [key: string]: unknown;
}

// User types
export interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

// Workflow types
export interface WorkflowNode {
  id: string;
  type: string;
  data: GenericRecord;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Execution types
export interface ExecutionLog {
  nodeId: string;
  status: 'running' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
  timestamp: string;
}

export interface ExecutionResult {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  logs: ExecutionLog[];
  result?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// Receipt types
export interface ReceiptData {
  vendor: string;
  amount: number;
  date: string;
  description?: string;
  category?: string;
  taxAmount?: number;
  subtotal?: number;
  confidence?: number;
}

export interface JobMatch {
  opportunity_id: string;
  opportunity_name: string;
  contact_name?: string;
  confidence_score: number;
  match_reason: string;
}

// API Key types
export interface APIKey {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  lastUsed?: string;
  createdAt: string;
}

// Integration types
export interface Integration {
  id: string;
  provider: string;
  name?: string;
  locationId?: string;
  companyId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  metadata?: GenericRecord;
}

// Commission types
export interface Commission {
  id: string;
  userId: string;
  opportunityId: string;
  receiptId?: string;
  percentage: number;
  amount?: number;
  status?: string;
}

// Time entry types
export interface TimeEntry {
  id: string;
  opportunityId: string;
  userId: string;
  description: string;
  hours: number;
  rate?: number;
  date: string;
  billable?: boolean;
}