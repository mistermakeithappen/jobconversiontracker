-- Chatbot Workflow System
-- Migration for tag-based workflow automation, chatbot settings, and conversation management

-- Create chatbot_settings table for universal settings
CREATE TABLE IF NOT EXISTS chatbot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tonality VARCHAR(50) DEFAULT 'professional' CHECK (tonality IN ('professional', 'friendly', 'casual', 'formal', 'enthusiastic')),
    typos_per_100_words INTEGER DEFAULT 1 CHECK (typos_per_100_words >= 0 AND typos_per_100_words <= 5),
    max_response_length INTEGER DEFAULT 150 CHECK (max_response_length > 0),
    response_speed VARCHAR(50) DEFAULT 'instant' CHECK (response_speed IN ('instant', '1-2_seconds', '3-5_seconds', 'natural_typing')),
    remember_conversation_history BOOLEAN DEFAULT true,
    use_ghl_contact_data BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create chatbot_workflows table for tag-based workflow definitions
CREATE TABLE IF NOT EXISTS chatbot_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_tag VARCHAR(255) NOT NULL, -- The GHL tag that triggers this workflow
    is_active BOOLEAN DEFAULT true,
    goal TEXT, -- The main objective of this workflow
    context TEXT, -- Background context for the AI
    knowledge_base JSONB DEFAULT '{}', -- Structured knowledge specific to this workflow
    workflow_config JSONB DEFAULT '{}', -- Visual workflow configuration (nodes, edges, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, trigger_tag) -- One workflow per user per tag
);

-- Create workflow_checkpoints table for conversation checkpoints and branching
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
    checkpoint_key VARCHAR(255) NOT NULL, -- Unique identifier within the workflow
    checkpoint_type VARCHAR(50) NOT NULL CHECK (checkpoint_type IN ('question', 'condition', 'action', 'end')),
    title VARCHAR(255) NOT NULL,
    content TEXT, -- The question or message content
    conditions JSONB DEFAULT '[]', -- Array of conditions that determine branching
    actions JSONB DEFAULT '[]', -- Actions to perform (add_tag, send_webhook, etc.)
    next_checkpoint_key VARCHAR(255), -- Default next checkpoint
    position_x INTEGER DEFAULT 0, -- X position in visual editor
    position_y INTEGER DEFAULT 0, -- Y position in visual editor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, checkpoint_key)
);

-- Create workflow_branches table for conditional branching logic
CREATE TABLE IF NOT EXISTS workflow_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id UUID NOT NULL REFERENCES workflow_checkpoints(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('contains_keyword', 'sentiment_analysis', 'contact_field', 'custom_field', 'regex_match')),
    condition_value TEXT NOT NULL, -- The value to match against
    next_checkpoint_key VARCHAR(255) NOT NULL, -- Where to go if condition is met
    priority INTEGER DEFAULT 0, -- Order to evaluate conditions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_sessions table to track ongoing conversations
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ghl_contact_id VARCHAR(255) NOT NULL, -- GoHighLevel contact ID
    workflow_id UUID REFERENCES chatbot_workflows(id) ON DELETE SET NULL,
    current_checkpoint_key VARCHAR(255), -- Current position in workflow
    session_data JSONB DEFAULT '{}', -- Store conversation variables and context
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, ghl_contact_id, workflow_id) -- One active session per contact per workflow
);

-- Create conversation_messages table to store chat history
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('user', 'bot', 'system')),
    content TEXT NOT NULL,
    checkpoint_key VARCHAR(255), -- Which checkpoint generated this message (for bot messages)
    metadata JSONB DEFAULT '{}', -- Additional message metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_actions table to log actions taken during conversations
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    checkpoint_id UUID REFERENCES workflow_checkpoints(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('add_tag', 'remove_tag', 'send_webhook', 'update_contact', 'create_opportunity', 'send_sms', 'send_email')),
    action_data JSONB NOT NULL, -- Specific action parameters
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatbot_workflows_user_active ON chatbot_workflows(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_workflows_trigger_tag ON chatbot_workflows(trigger_tag);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow ON workflow_checkpoints(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_branches_checkpoint ON workflow_branches(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_contact ON conversation_sessions(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON conversation_sessions(is_active, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_created ON conversation_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_session ON workflow_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_status ON workflow_actions(status);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chatbot_settings_updated_at BEFORE UPDATE ON chatbot_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbot_workflows_updated_at BEFORE UPDATE ON chatbot_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_checkpoints_updated_at BEFORE UPDATE ON workflow_checkpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default chatbot settings for existing users (if any)
-- This will be safe to run multiple times due to the UNIQUE constraint
INSERT INTO chatbot_settings (user_id, tonality, typos_per_100_words, max_response_length)
SELECT DISTINCT user_id, 'professional', 1, 150
FROM integrations 
WHERE type = 'gohighlevel' 
ON CONFLICT (user_id) DO NOTHING;

-- Sample workflow data (appointment setter example)
-- This demonstrates the structure but won't insert duplicate data
INSERT INTO chatbot_workflows (
    user_id, 
    name, 
    description, 
    trigger_tag, 
    goal, 
    context, 
    knowledge_base
) 
SELECT 
    user_id,
    'Appointment Setter Bot',
    'Automated appointment booking workflow for prospects with appointment-setter tag',
    'appointment-setter',
    'Schedule qualified prospects for sales calls by gathering their availability and booking appointments',
    'This workflow is designed to interact with prospects who have shown interest in scheduling a consultation. Be professional but friendly, and focus on finding a convenient time for both parties.',
    '{"services": ["consultation", "demo", "strategy_session"], "availability": "Monday-Friday 9AM-5PM EST", "booking_link": "https://calendly.com/example"}'
FROM integrations 
WHERE type = 'gohighlevel' 
LIMIT 1
ON CONFLICT (user_id, trigger_tag) DO NOTHING;