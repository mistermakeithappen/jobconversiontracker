-- Create chat sessions table for bot conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_variables JSONB DEFAULT '{}',
    conversation_history JSONB DEFAULT '[]',
    current_node_id VARCHAR(255),
    workflow_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_bot_id ON chat_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- Disable RLS for now (using service role)
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;