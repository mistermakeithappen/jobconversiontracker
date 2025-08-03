// Bot System Type Definitions

export interface Bot {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  global_context: string;
  specific_context: string;
  knowledge_base: Record<string, any>;
  personality_config: PersonalityConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalityConfig {
  tone: 'professional' | 'friendly' | 'casual' | 'formal' | 'enthusiastic';
  style: 'conversational' | 'concise' | 'detailed' | 'technical';
  response_length: 'brief' | 'concise' | 'detailed' | 'comprehensive';
  typing_speed?: 'instant' | 'fast' | 'natural' | 'slow';
  use_emojis?: boolean;
  formality_level?: number; // 1-10
}

export interface BotWorkflow {
  bot_id: string;
  workflow_id: string;
  is_primary: boolean;
  priority: number;
  created_at: string;
}

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_id: string;
  node_type: NodeType;
  title: string;
  description?: string;
  goal_description?: string;
  possible_outcomes?: string[];
  calendar_ids?: string[];
  position_x: number;
  position_y: number;
  config: NodeConfig;
  actions: WorkflowAction[];
  created_at: string;
  updated_at: string;
}

export type NodeType = 
  | 'start' 
  | 'milestone' 
  | 'book_appointment' 
  | 'appointment' // alias for compatibility
  | 'message' 
  | 'condition' 
  | 'action' 
  | 'ghl_action' // alias for GHL actions
  | 'end'
  | 'ai' // AI assistant node
  | 'variable' // variable setter node
  | 'ghl_calendar'
  | 'ghl_tags'
  | 'ghl_custom_fields';

export interface NodeConfig {
  // Common config
  message?: string;
  delay?: number;
  
  // Milestone specific
  evaluation_prompt?: string;
  success_threshold?: number;
  max_attempts?: number;
  
  // Appointment specific
  duration_minutes?: number;
  buffer_minutes?: number;
  confirmation_required?: boolean;
  reminder_enabled?: boolean;
  reminder_message?: string;
  
  // Condition specific
  condition_type?: 'keyword' | 'sentiment' | 'intent' | 'custom';
  condition_logic?: string;
  conditions?: Array<{ label: string; value: string }>;
  field_name?: string;
  operator?: string;
  value?: string;
  
  // Action specific
  webhook_url?: string;
  webhook_method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhook_headers?: Record<string, string>;
  
  // GHL Calendar specific
  calendar_ids?: string[];
  available_slots?: number;
  booking_confirmation_message?: string;
  
  // GHL Tags specific
  tag_action?: 'add' | 'remove' | 'add_multiple' | 'remove_multiple';
  tags?: string[];
  create_if_not_exists?: boolean;
  
  // GHL Custom Fields specific
  custom_field_id?: string;
  custom_field_value?: any;
  custom_field_action?: 'read' | 'write' | 'update';
  
  // End node specific
  save_conversation?: boolean;
  extra_instructions?: string;
  
  // Visual
  icon?: string;
  color?: string;
  
  // AI node specific
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  include_history?: boolean;
  store_in_variable?: string;
  
  // Variable node specific
  variable_name?: string;
  variable?: string;
  
  // Appointment node specific
  calendar_id?: string;
  calendar_name?: string;
  
  // Action node specific
  action_type?: string;
  tag?: string;
}

export interface WorkflowAction {
  type: ActionType;
  data: Record<string, any>;
  condition?: ActionCondition;
  priority?: number;
}

export type ActionType = 
  | 'add_tag' 
  | 'remove_tag' 
  | 'send_webhook' 
  | 'update_contact' 
  | 'create_opportunity' 
  | 'send_sms' 
  | 'send_email' 
  | 'book_appointment'
  | 'update_custom_field' 
  | 'add_to_campaign' 
  | 'remove_from_campaign'
  | 'fetch_calendars'
  | 'book_ghl_appointment'
  | 'get_custom_fields'
  | 'set_custom_field';

export interface ActionCondition {
  type: 'always' | 'on_success' | 'on_failure' | 'custom';
  logic?: string;
}

export interface WorkflowConnection {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  condition?: ConnectionCondition;
  label?: string;
  created_at: string;
}

export type ConnectionType = 
  | 'standard' 
  | 'conditional' 
  | 'goal_achieved' 
  | 'goal_not_achieved';

export interface ConnectionCondition {
  type: 'keyword' | 'sentiment' | 'intent' | 'data_extraction' | 'custom';
  value: any;
  operator?: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
}

export interface ConversationSession {
  id: string;
  user_id: string;
  bot_id: string;
  ghl_contact_id: string;
  workflow_id: string;
  current_checkpoint_key: string;
  session_data: Record<string, any>;
  is_active: boolean;
  started_at: string;
  last_activity_at: string;
  ended_at?: string;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  message_type: 'user' | 'bot' | 'system';
  content: string;
  checkpoint_key?: string;
  goal_evaluation_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WorkflowGoalEvaluation {
  id: string;
  session_id: string;
  node_id: string;
  user_message: string;
  ai_evaluation: GoalEvaluationResult;
  goal_achieved: boolean;
  confidence_score: number;
  reasoning: string;
  selected_outcome?: string;
  created_at: string;
}

export interface GoalEvaluationResult {
  achieved: boolean;
  confidence: number;
  reasoning: string;
  selectedOutcome?: string;
  suggestedResponse?: string;
  extractedData?: Record<string, any>;
}

export interface BotKnowledgeBase {
  id: string;
  bot_id: string;
  category: string;
  key: string;
  value: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentBooking {
  id: string;
  session_id: string;
  node_id: string;
  calendar_id: string;
  appointment_id?: string;
  contact_id: string;
  proposed_times: string[];
  selected_time?: string;
  status: BookingStatus;
  booking_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 
  | 'pending' 
  | 'proposed' 
  | 'confirmed' 
  | 'cancelled' 
  | 'failed';

// API Request/Response Types

export interface CreateBotRequest {
  name: string;
  description?: string;
  avatar_url?: string;
  global_context?: string;
  specific_context?: string;
  knowledge_base?: Record<string, any>;
  personality_config?: Partial<PersonalityConfig>;
  workflow_ids?: string[];
}

export interface UpdateBotRequest {
  bot_id: string;
  name?: string;
  description?: string;
  avatar_url?: string;
  global_context?: string;
  specific_context?: string;
  knowledge_base?: Record<string, any>;
  personality_config?: Partial<PersonalityConfig>;
  is_active?: boolean;
}

export interface ChatRequest {
  message: string;
  contactId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
}

export interface KnowledgeBaseEntry {
  category: string;
  key: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface WorkflowNodeUpdate {
  node_id: string;
  title?: string;
  description?: string;
  goal_description?: string;
  possible_outcomes?: string[];
  calendar_ids?: string[];
  position_x?: number;
  position_y?: number;
  config?: Partial<NodeConfig>;
  actions?: WorkflowAction[];
}

export interface WorkflowUpdate {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

// Visual Editor Types for React Flow

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    node: WorkflowNode;
    isSelected?: boolean;
    isValid?: boolean;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  data?: {
    connection: WorkflowConnection;
  };
  animated?: boolean;
  style?: any;
}

// Analytics Types

export interface BotAnalytics {
  bot_id: string;
  total_conversations: number;
  active_conversations: number;
  completed_conversations: number;
  average_session_duration: number;
  goal_achievement_rate: number;
  most_common_outcomes: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
  conversation_volume_by_day: Array<{
    date: string;
    count: number;
  }>;
  node_performance: Array<{
    node_id: string;
    node_title: string;
    visits: number;
    goal_achievement_rate: number;
    average_time_spent: number;
  }>;
}