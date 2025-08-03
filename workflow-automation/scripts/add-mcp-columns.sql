-- Add MCP (Model Context Protocol) columns to integrations table
-- Run this script in your Supabase SQL Editor to enable GoHighLevel Private Integration Token support

-- Add mcp_enabled column
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false;

-- Add mcp_token_encrypted column (stores encrypted token or reference to user_api_keys)
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_token_encrypted TEXT;

-- Add mcp_endpoint column
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_endpoint TEXT DEFAULT 'https://services.leadconnectorhq.com/mcp/';

-- Add mcp_capabilities column to cache available MCP tools/resources
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_capabilities JSONB DEFAULT '{}';

-- Add mcp_last_connected_at column
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_last_connected_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the mcp_token_encrypted format
COMMENT ON COLUMN integrations.mcp_token_encrypted IS 'Stores either an encrypted token directly or a JSON reference to user_api_keys table like {"type": "user_api_keys_reference", "api_key_id": "uuid"}';

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name IN ('mcp_enabled', 'mcp_token_encrypted', 'mcp_endpoint', 'mcp_capabilities', 'mcp_last_connected_at')
ORDER BY ordinal_position;