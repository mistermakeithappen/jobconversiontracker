-- Add MCP (Model Context Protocol) support to integrations

-- Add MCP-related fields to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mcp_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mcp_endpoint TEXT,
ADD COLUMN IF NOT EXISTS mcp_capabilities JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mcp_last_connected_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN integrations.mcp_enabled IS 'Whether MCP is enabled for this integration';
COMMENT ON COLUMN integrations.mcp_token_encrypted IS 'Encrypted MCP bearer token';
COMMENT ON COLUMN integrations.mcp_endpoint IS 'MCP server endpoint URL';
COMMENT ON COLUMN integrations.mcp_capabilities IS 'Cached list of MCP tools, resources, and prompts';
COMMENT ON COLUMN integrations.mcp_last_connected_at IS 'Last successful MCP connection timestamp';