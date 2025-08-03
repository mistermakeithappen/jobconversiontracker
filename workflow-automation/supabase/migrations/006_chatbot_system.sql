-- 006_chatbot_system.sql
-- Advanced chatbot system with workflows, conversations, and AI integration

-- 1. Bots table
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Bot configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  
  -- Knowledge and context
  global_context TEXT, -- Shared knowledge across all conversations
  specific_context TEXT, -- Bot-specific knowledge and instructions
  knowledge_base JSONB DEFAULT '{}', -- Structured knowledge repository
  personality_config JSONB DEFAULT '{}', -- Tone, style, response patterns
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, name)
);

-- 2. Chatbot workflows
CREATE TABLE chatbot_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Workflow details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL CHECK (
    trigger_type IN ('message', 'tag', 'form_submission', 'appointment', 'manual')
  ),
  trigger_config JSONB DEFAULT '{}',
  
  -- Workflow configuration
  workflow_config JSONB DEFAULT '{}',
  initial_checkpoint VARCHAR(255),
  
  -- Visual editor data
  flow_data JSONB DEFAULT '{}', -- React Flow node/edge data
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, name)
);

-- 3. Bot workflows junction table
CREATE TABLE bot_workflows (
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (bot_id, workflow_id)
);

-- 4. Workflow nodes (unified structure for all node types)
CREATE TABLE workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  
  -- Node identification
  node_id VARCHAR(255) NOT NULL, -- Unique within workflow
  node_type VARCHAR(50) NOT NULL CHECK (node_type IN (
    'start', 'message', 'question', 'condition', 'action', 
    'milestone', 'book_appointment', 'end', 'goal'
  )),
  
  -- Node content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT, -- Message content or question text
  
  -- Goal-based fields
  goal_description TEXT,
  possible_outcomes JSONB DEFAULT '[]',
  
  -- Appointment fields
  calendar_ids JSONB DEFAULT '[]',
  
  -- Conditional logic
  conditions JSONB DEFAULT '[]',
  
  -- Actions to perform
  actions JSONB DEFAULT '[]',
  
  -- Visual positioning
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  
  -- Configuration
  config JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workflow_id, node_id)
);

-- 5. Workflow connections
CREATE TABLE workflow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  
  -- Connection details
  source_node_id VARCHAR(255) NOT NULL,
  target_node_id VARCHAR(255) NOT NULL,
  connection_type VARCHAR(50) DEFAULT 'standard' CHECK (connection_type IN (
    'standard', 'conditional', 'goal_achieved', 'goal_not_achieved', 'always'
  )),
  
  -- Conditional connection
  condition JSONB DEFAULT '{}',
  label VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workflow_id, source_node_id, target_node_id, connection_type)
);

-- 6. Conversation sessions
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES chatbot_workflows(id) ON DELETE SET NULL,
  
  -- Contact information
  contact_id VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  contact_name VARCHAR(255),
  
  -- Session state
  current_node_id VARCHAR(255),
  session_data JSONB DEFAULT '{}', -- Collected data during conversation
  context JSONB DEFAULT '{}', -- Session-specific context
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'abandoned', 'error')
  ),
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Conversation messages
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  
  -- Message details
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('user', 'bot', 'system')),
  content TEXT NOT NULL,
  
  -- Node tracking
  node_id VARCHAR(255),
  
  -- Goal evaluation reference
  goal_evaluation_id UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Workflow goal evaluations
CREATE TABLE workflow_goal_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  
  -- Evaluation details
  user_message TEXT NOT NULL,
  ai_evaluation JSONB NOT NULL,
  goal_achieved BOOLEAN NOT NULL,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT,
  selected_outcome TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Workflow actions log
CREATE TABLE workflow_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  
  -- Action details
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'add_tag', 'remove_tag', 'send_webhook', 'update_contact', 
    'create_opportunity', 'send_sms', 'send_email', 'book_appointment',
    'update_custom_field', 'add_to_campaign', 'remove_from_campaign'
  )),
  action_config JSONB NOT NULL,
  
  -- Execution details
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'failed', 'skipped')
  ),
  executed_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Bot knowledge base
CREATE TABLE bot_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  
  -- Knowledge entry
  category VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(bot_id, category, key)
);

-- 11. Appointment bookings
CREATE TABLE appointment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  
  -- Booking details
  calendar_id VARCHAR(255) NOT NULL,
  appointment_id VARCHAR(255),
  contact_id VARCHAR(255) NOT NULL,
  
  -- Times
  proposed_times JSONB DEFAULT '[]',
  selected_time TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'proposed', 'confirmed', 'cancelled', 'failed')
  ),
  
  -- Additional data
  booking_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Chat sessions table (for real-time chat)
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  
  -- Session details
  session_key VARCHAR(255) UNIQUE NOT NULL,
  contact_id VARCHAR(255),
  
  -- State
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Context
  context JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes
CREATE INDEX idx_bots_org ON bots(organization_id);
CREATE INDEX idx_bots_active ON bots(organization_id, is_active) WHERE is_active = true;

CREATE INDEX idx_chatbot_workflows_org ON chatbot_workflows(organization_id);
CREATE INDEX idx_chatbot_workflows_active ON chatbot_workflows(organization_id, is_active) WHERE is_active = true;

CREATE INDEX idx_bot_workflows_bot ON bot_workflows(bot_id);
CREATE INDEX idx_bot_workflows_workflow ON bot_workflows(workflow_id);

CREATE INDEX idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_type ON workflow_nodes(node_type);

CREATE INDEX idx_workflow_connections_workflow ON workflow_connections(workflow_id);
CREATE INDEX idx_workflow_connections_source ON workflow_connections(workflow_id, source_node_id);
CREATE INDEX idx_workflow_connections_target ON workflow_connections(workflow_id, target_node_id);

CREATE INDEX idx_conversation_sessions_bot ON conversation_sessions(bot_id);
CREATE INDEX idx_conversation_sessions_contact ON conversation_sessions(contact_id);
CREATE INDEX idx_conversation_sessions_status ON conversation_sessions(status);

CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_conversation_messages_created ON conversation_messages(created_at);

CREATE INDEX idx_workflow_goal_evaluations_session ON workflow_goal_evaluations(session_id);
CREATE INDEX idx_workflow_goal_evaluations_node ON workflow_goal_evaluations(node_id);

CREATE INDEX idx_workflow_actions_log_session ON workflow_actions_log(session_id);
CREATE INDEX idx_workflow_actions_log_status ON workflow_actions_log(status);

CREATE INDEX idx_bot_knowledge_base_bot ON bot_knowledge_base(bot_id);
CREATE INDEX idx_bot_knowledge_base_category ON bot_knowledge_base(bot_id, category);

CREATE INDEX idx_appointment_bookings_session ON appointment_bookings(session_id);
CREATE INDEX idx_appointment_bookings_status ON appointment_bookings(status);

CREATE INDEX idx_chat_sessions_key ON chat_sessions(session_key);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(is_active, expires_at);

-- Create triggers
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbot_workflows_updated_at BEFORE UPDATE ON chatbot_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_nodes_updated_at BEFORE UPDATE ON workflow_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_knowledge_base_updated_at BEFORE UPDATE ON bot_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointment_bookings_updated_at BEFORE UPDATE ON appointment_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_goal_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Add foreign key for goal evaluations
ALTER TABLE conversation_messages
  ADD CONSTRAINT fk_conversation_messages_goal_evaluation
  FOREIGN KEY (goal_evaluation_id) REFERENCES workflow_goal_evaluations(id);