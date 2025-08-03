-- 007_mcp_integration.sql
-- Model Context Protocol (MCP) integration for enhanced AI capabilities

-- 1. MCP integration settings
CREATE TABLE mcp_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- MCP configuration
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('ghl', 'ghlmcp')),
  endpoint_url TEXT,
  
  -- Authentication
  private_integration_token TEXT, -- Encrypted PIT token
  location_id VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status VARCHAR(50) CHECK (test_status IN ('success', 'failed', 'pending')),
  test_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id)
);

-- 2. MCP tools registry
CREATE TABLE mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tool identification
  tool_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Tool details
  description TEXT,
  parameters_schema JSONB NOT NULL DEFAULT '{}',
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(provider, tool_name)
);

-- 3. MCP tool executions log
CREATE TABLE mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES mcp_tools(id),
  
  -- Execution context
  session_id UUID, -- Reference to chat/workflow session
  user_id UUID REFERENCES users(id),
  
  -- Request details
  tool_name VARCHAR(255) NOT NULL,
  request_params JSONB NOT NULL,
  
  -- Response details
  response_data JSONB,
  response_type VARCHAR(50) CHECK (response_type IN ('json', 'stream', 'error')),
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'timeout')
  ),
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert default GHL MCP tools
INSERT INTO mcp_tools (tool_name, category, provider, description, parameters_schema) VALUES
-- Calendar tools
('calendars_get-calendar-events', 'calendar', 'ghl', 'Get calendar events', '{"limit": {"type": "number"}, "startTime": {"type": "string"}, "endTime": {"type": "string"}}'::jsonb),
('calendars_get-appointment-notes', 'calendar', 'ghl', 'Get appointment notes', '{"appointmentId": {"type": "string", "required": true}}'::jsonb),

-- Contact tools
('contacts_get-contacts', 'contacts', 'ghl', 'Get contacts list', '{"limit": {"type": "number"}, "query": {"type": "string"}}'::jsonb),
('contacts_get-contact', 'contacts', 'ghl', 'Get specific contact', '{"contactId": {"type": "string", "required": true}}'::jsonb),
('contacts_create-contact', 'contacts', 'ghl', 'Create new contact', '{"firstName": {"type": "string"}, "lastName": {"type": "string"}, "email": {"type": "string"}, "phone": {"type": "string"}}'::jsonb),
('contacts_update-contact', 'contacts', 'ghl', 'Update contact', '{"contactId": {"type": "string", "required": true}, "fields": {"type": "object"}}'::jsonb),
('contacts_upsert-contact', 'contacts', 'ghl', 'Create or update contact', '{"email": {"type": "string"}, "phone": {"type": "string"}, "fields": {"type": "object"}}'::jsonb),
('contacts_add-tags', 'contacts', 'ghl', 'Add tags to contact', '{"contactId": {"type": "string", "required": true}, "tags": {"type": "array", "items": {"type": "string"}}}'::jsonb),
('contacts_remove-tags', 'contacts', 'ghl', 'Remove tags from contact', '{"contactId": {"type": "string", "required": true}, "tags": {"type": "array", "items": {"type": "string"}}}'::jsonb),
('contacts_get-all-tasks', 'contacts', 'ghl', 'Get tasks for contact', '{"contactId": {"type": "string", "required": true}}'::jsonb),

-- Conversation tools
('conversations_search-conversation', 'conversations', 'ghl', 'Search conversations', '{"contactId": {"type": "string", "required": true}}'::jsonb),
('conversations_get-messages', 'conversations', 'ghl', 'Get conversation messages', '{"conversationId": {"type": "string", "required": true}}'::jsonb),
('conversations_send-a-new-message', 'conversations', 'ghl', 'Send message', '{"contactId": {"type": "string", "required": true}, "message": {"type": "string", "required": true}}'::jsonb),

-- Location tools
('locations_get-location', 'locations', 'ghl', 'Get location details', '{}'::jsonb),
('locations_get-custom-fields', 'locations', 'ghl', 'Get custom fields', '{}'::jsonb),

-- Opportunity tools
('opportunities_search-opportunity', 'opportunities', 'ghl', 'Search opportunities', '{"query": {"type": "string"}}'::jsonb),
('opportunities_get-opportunity', 'opportunities', 'ghl', 'Get opportunity details', '{"opportunityId": {"type": "string", "required": true}}'::jsonb),
('opportunities_update-opportunity', 'opportunities', 'ghl', 'Update opportunity', '{"opportunityId": {"type": "string", "required": true}, "fields": {"type": "object"}}'::jsonb),
('opportunities_get-pipelines', 'opportunities', 'ghl', 'Get pipelines', '{}'::jsonb),

-- Payment tools
('payments_get-order-by-id', 'payments', 'ghl', 'Get order details', '{"orderId": {"type": "string", "required": true}}'::jsonb),
('payments_list-transactions', 'payments', 'ghl', 'List transactions', '{"limit": {"type": "number"}, "startDate": {"type": "string"}, "endDate": {"type": "string"}}'::jsonb);

-- Create indexes
CREATE INDEX idx_mcp_integrations_org ON mcp_integrations(organization_id);
CREATE INDEX idx_mcp_integrations_integration ON mcp_integrations(integration_id);
CREATE INDEX idx_mcp_integrations_active ON mcp_integrations(is_active) WHERE is_active = true;

CREATE INDEX idx_mcp_tools_provider ON mcp_tools(provider);
CREATE INDEX idx_mcp_tools_category ON mcp_tools(category);

CREATE INDEX idx_mcp_tool_executions_org ON mcp_tool_executions(organization_id);
CREATE INDEX idx_mcp_tool_executions_integration ON mcp_tool_executions(integration_id);
CREATE INDEX idx_mcp_tool_executions_tool ON mcp_tool_executions(tool_id);
CREATE INDEX idx_mcp_tool_executions_session ON mcp_tool_executions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_mcp_tool_executions_status ON mcp_tool_executions(status);

-- Create triggers
CREATE TRIGGER update_mcp_integrations_updated_at BEFORE UPDATE ON mcp_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mcp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;