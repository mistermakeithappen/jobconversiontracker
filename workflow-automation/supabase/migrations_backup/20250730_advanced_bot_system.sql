-- Advanced Bot System Migration
-- Adds support for multiple bots, enhanced workflows, goal-based reasoning, and appointment booking

-- Create bots table for managing multiple chatbots
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    global_context TEXT, -- Shared knowledge across all conversations
    specific_context TEXT, -- Bot-specific knowledge and instructions
    knowledge_base JSONB DEFAULT '{}', -- Structured knowledge repository
    personality_config JSONB DEFAULT '{}', -- Tone, style, response patterns
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Create bot_workflows junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS bot_workflows (
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false, -- Default workflow for the bot
    priority INTEGER DEFAULT 0, -- Order of workflow evaluation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (bot_id, workflow_id)
);

-- Create enhanced workflow_nodes table (replacing workflow_checkpoints)
CREATE TABLE IF NOT EXISTS workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL, -- Unique identifier within workflow
    node_type VARCHAR(50) NOT NULL CHECK (node_type IN (
        'start', 'milestone', 'book_appointment', 'message', 
        'condition', 'action', 'end'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    -- Milestone-specific fields
    goal_description TEXT, -- What the bot is trying to achieve
    possible_outcomes JSONB DEFAULT '[]', -- Array of possible outcomes for milestone
    -- Appointment-specific fields
    calendar_ids JSONB DEFAULT '[]', -- Array of calendar IDs to book from
    -- Visual positioning
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    -- Configuration and data
    config JSONB DEFAULT '{}', -- Node-specific configuration
    actions JSONB DEFAULT '[]', -- Actions to perform (tags, webhooks, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, node_id)
);

-- Create workflow_connections table (edges between nodes)
CREATE TABLE IF NOT EXISTS workflow_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
    source_node_id VARCHAR(255) NOT NULL,
    target_node_id VARCHAR(255) NOT NULL,
    connection_type VARCHAR(50) DEFAULT 'standard' CHECK (connection_type IN (
        'standard', 'conditional', 'goal_achieved', 'goal_not_achieved'
    )),
    condition JSONB DEFAULT '{}', -- Condition for conditional connections
    label VARCHAR(255), -- Visual label for the connection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, source_node_id, target_node_id, connection_type)
);

-- Create workflow_goal_evaluations table for AI reasoning tracking
CREATE TABLE IF NOT EXISTS workflow_goal_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    ai_evaluation JSONB NOT NULL, -- Full evaluation result
    goal_achieved BOOLEAN NOT NULL,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    reasoning TEXT, -- AI's explanation of its decision
    selected_outcome TEXT, -- Which outcome was selected (for milestones)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bot_knowledge_base table for structured knowledge
CREATE TABLE IF NOT EXISTS bot_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    category VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bot_id, category, key)
);

-- Create appointment_bookings table to track appointments
CREATE TABLE IF NOT EXISTS appointment_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255) NOT NULL,
    appointment_id VARCHAR(255), -- GHL appointment ID
    contact_id VARCHAR(255) NOT NULL,
    proposed_times JSONB DEFAULT '[]', -- Times suggested by bot
    selected_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'proposed', 'confirmed', 'cancelled', 'failed'
    )),
    booking_data JSONB DEFAULT '{}', -- Additional booking information
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update conversation_sessions to include bot_id
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES bots(id) ON DELETE SET NULL;

-- Update conversation_messages to include goal evaluation
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS goal_evaluation_id UUID REFERENCES workflow_goal_evaluations(id) ON DELETE SET NULL;

-- Add new action types to workflow_actions check constraint
ALTER TABLE workflow_actions 
DROP CONSTRAINT IF EXISTS workflow_actions_action_type_check;

ALTER TABLE workflow_actions 
ADD CONSTRAINT workflow_actions_action_type_check 
CHECK (action_type IN (
    'add_tag', 'remove_tag', 'send_webhook', 'update_contact', 
    'create_opportunity', 'send_sms', 'send_email', 'book_appointment',
    'update_custom_field', 'add_to_campaign', 'remove_from_campaign'
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bots_user_active ON bots(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bot_workflows_bot ON bot_workflows(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_workflows_workflow ON bot_workflows(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type ON workflow_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_workflow ON workflow_connections(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_source ON workflow_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_target ON workflow_connections(target_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_goal_evaluations_session ON workflow_goal_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_goal_evaluations_node ON workflow_goal_evaluations(node_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_base_bot ON bot_knowledge_base(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_base_category ON bot_knowledge_base(bot_id, category);
CREATE INDEX IF NOT EXISTS idx_appointment_bookings_session ON appointment_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_appointment_bookings_status ON appointment_bookings(status);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_bot ON conversation_sessions(bot_id);

-- Create updated_at triggers for new tables
CREATE TRIGGER update_bots_updated_at 
BEFORE UPDATE ON bots 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_nodes_updated_at 
BEFORE UPDATE ON workflow_nodes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_knowledge_base_updated_at 
BEFORE UPDATE ON bot_knowledge_base 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_bookings_updated_at 
BEFORE UPDATE ON appointment_bookings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a default bot for existing users with GHL integration
INSERT INTO bots (user_id, name, description, global_context, personality_config)
SELECT DISTINCT 
    user_id,
    'Default Assistant',
    'Your AI-powered assistant for automated conversations',
    'You are a helpful AI assistant that helps with customer inquiries and appointment scheduling.',
    '{"tone": "professional", "style": "conversational", "response_length": "concise"}'::jsonb
FROM integrations 
WHERE type = 'gohighlevel' 
    AND is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM bots b WHERE b.user_id = integrations.user_id
    );

-- Migrate existing chatbot_workflows to work with the new system
-- This preserves existing data while making it compatible with new structure
UPDATE chatbot_workflows 
SET workflow_config = COALESCE(workflow_config, '{}')::jsonb || 
    '{"version": "2.0", "migrated": true}'::jsonb
WHERE (workflow_config->>'version') IS NULL;

-- Create initial workflow nodes from existing checkpoints
INSERT INTO workflow_nodes (
    workflow_id, 
    node_id, 
    node_type, 
    title, 
    description,
    position_x, 
    position_y,
    config
)
SELECT 
    workflow_id,
    checkpoint_key,
    CASE 
        WHEN checkpoint_type = 'question' THEN 'message'
        WHEN checkpoint_type = 'condition' THEN 'condition'
        WHEN checkpoint_type = 'action' THEN 'action'
        WHEN checkpoint_type = 'end' THEN 'end'
        ELSE checkpoint_type
    END,
    title,
    content,
    COALESCE(position_x, 0),
    COALESCE(position_y, 0),
    json_build_object(
        'migrated_from_checkpoint', true,
        'original_type', checkpoint_type,
        'conditions', COALESCE(conditions, '[]'::jsonb),
        'actions', COALESCE(actions, '[]'::jsonb)
    )::jsonb
FROM workflow_checkpoints
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_nodes wn 
    WHERE wn.workflow_id = workflow_checkpoints.workflow_id 
    AND wn.node_id = workflow_checkpoints.checkpoint_key
);

-- Create connections from checkpoint relationships
INSERT INTO workflow_connections (
    workflow_id,
    source_node_id,
    target_node_id,
    connection_type
)
SELECT DISTINCT
    wc.workflow_id,
    wc.checkpoint_key,
    wc.next_checkpoint_key,
    'standard'
FROM workflow_checkpoints wc
WHERE wc.next_checkpoint_key IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM workflow_connections conn
        WHERE conn.workflow_id = wc.workflow_id
        AND conn.source_node_id = wc.checkpoint_key
        AND conn.target_node_id = wc.next_checkpoint_key
    );

-- Add start nodes to workflows that don't have them
INSERT INTO workflow_nodes (workflow_id, node_id, node_type, title, position_x, position_y)
SELECT DISTINCT 
    w.id,
    'start',
    'start',
    'Start',
    -200,
    0
FROM chatbot_workflows w
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_nodes wn 
    WHERE wn.workflow_id = w.id 
    AND wn.node_type = 'start'
);

-- Connect existing bots to their workflows
INSERT INTO bot_workflows (bot_id, workflow_id, is_primary)
SELECT 
    b.id,
    w.id,
    true
FROM bots b
JOIN chatbot_workflows w ON b.user_id = w.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM bot_workflows bw 
    WHERE bw.bot_id = b.id 
    AND bw.workflow_id = w.id
);

-- Grant necessary permissions
GRANT ALL ON bots TO authenticated;
GRANT ALL ON bot_workflows TO authenticated;
GRANT ALL ON workflow_nodes TO authenticated;
GRANT ALL ON workflow_connections TO authenticated;
GRANT ALL ON workflow_goal_evaluations TO authenticated;
GRANT ALL ON bot_knowledge_base TO authenticated;
GRANT ALL ON appointment_bookings TO authenticated;