-- 010_supplemental_tables.sql
-- Supplemental tables required for complete app functionality

-- 1. User payment structures (for time tracking and payroll)
CREATE TABLE user_payment_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- User identification (can be GHL user ID or team member)
  user_id VARCHAR NOT NULL, -- GHL user ID for backwards compatibility
  ghl_user_name VARCHAR,
  ghl_user_email VARCHAR,
  ghl_user_phone VARCHAR,
  
  -- Link to team member (for new structure)
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  
  -- Payment configuration
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN (
    'hourly', 'salary', 'commission_gross', 'commission_profit', 'hybrid', 'contractor'
  )),
  hourly_rate DECIMAL(10,2),
  annual_salary DECIMAL(12,2),
  commission_percentage DECIMAL(5,2) CHECK (
    commission_percentage IS NULL OR (commission_percentage >= 0 AND commission_percentage <= 100)
  ),
  base_salary DECIMAL(12,2), -- For hybrid salary + commission
  overtime_rate DECIMAL(10,2),
  
  -- Status and metadata
  notes TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, user_id, effective_date)
);

-- 2. User payment assignments (junction table for active assignments)
CREATE TABLE user_payment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- User identification
  ghl_user_id VARCHAR NOT NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  
  -- Payment structure reference
  payment_structure_id UUID NOT NULL REFERENCES user_payment_structures(id) ON DELETE CASCADE,
  
  -- Assignment metadata
  assigned_date DATE DEFAULT CURRENT_DATE,
  assigned_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, ghl_user_id)
);

-- 3. Opportunity cache (for performance optimization)
CREATE TABLE opportunity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  opportunity_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255),
  
  -- Basic info
  title VARCHAR(255),
  stage VARCHAR(255),
  status VARCHAR(50),
  monetary_value DECIMAL(12,2) DEFAULT 0,
  
  -- Calculated fields
  total_expenses DECIMAL(12,2) DEFAULT 0,
  total_labor_cost DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) GENERATED ALWAYS AS (
    monetary_value - total_expenses - total_labor_cost
  ) STORED,
  profit_margin DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN monetary_value > 0 THEN 
        ((monetary_value - total_expenses - total_labor_cost) / monetary_value) * 100
      ELSE 0
    END
  ) STORED,
  
  -- Contact info
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Metadata
  pipeline_id VARCHAR(255),
  pipeline_name VARCHAR(255),
  assigned_to VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ghl_updated_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, opportunity_id)
);

-- 4. Incoming messages (for webhook message processing)
CREATE TABLE incoming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Message identifiers
  ghl_message_id VARCHAR UNIQUE,
  ghl_conversation_id VARCHAR,
  ghl_contact_id VARCHAR,
  
  -- Contact info
  phone_number VARCHAR,
  phone_normalized VARCHAR,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Message content
  message_type VARCHAR NOT NULL, -- sms, mms, email, etc.
  body TEXT,
  attachments JSONB DEFAULT '[]',
  direction VARCHAR NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  has_receipt BOOLEAN DEFAULT false,
  receipt_processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  
  -- Timestamps
  ghl_created_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Chatbot settings (for bot configuration)
CREATE TABLE chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  
  -- Settings
  setting_key VARCHAR(255) NOT NULL,
  setting_value JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(bot_id, setting_key)
);

-- 6. Legacy workflow tables (for backwards compatibility)
CREATE TABLE workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  
  -- Checkpoint details
  checkpoint_key VARCHAR(255) NOT NULL,
  checkpoint_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  
  -- Flow control
  next_checkpoint_key VARCHAR(255),
  conditions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  
  -- Visual positioning
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workflow_id, checkpoint_key)
);

CREATE TABLE workflow_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES workflow_checkpoints(id) ON DELETE CASCADE,
  
  -- Branch details
  branch_key VARCHAR(255) NOT NULL,
  condition JSONB NOT NULL,
  next_checkpoint_key VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(checkpoint_id, branch_key)
);

CREATE TABLE workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES chatbot_workflows(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES workflow_checkpoints(id) ON DELETE CASCADE,
  
  -- Action details
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'add_tag', 'remove_tag', 'send_webhook', 'update_contact', 
    'create_opportunity', 'send_sms', 'send_email', 'book_appointment',
    'update_custom_field', 'add_to_campaign', 'remove_from_campaign'
  )),
  action_config JSONB NOT NULL,
  execution_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Additional commission tables (for complex commission scenarios)
CREATE TABLE user_commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Commission configuration
  structure_name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  
  -- Rate configuration
  base_rate DECIMAL(5,2),
  subscription_initial_rate DECIMAL(5,2),
  subscription_renewal_rate DECIMAL(5,2),
  
  -- Tiered rates
  tier_config JSONB DEFAULT '[]',
  
  -- Conditions
  applies_to_products JSONB DEFAULT '[]',
  applies_to_pipelines JSONB DEFAULT '[]',
  min_sale_amount DECIMAL(10,2),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(team_member_id, structure_name)
);

CREATE TABLE opportunity_commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Override details
  override_type VARCHAR(50) NOT NULL CHECK (override_type IN ('rate', 'amount', 'structure')),
  override_rate DECIMAL(5,2),
  override_amount DECIMAL(10,2),
  override_structure_id UUID REFERENCES user_commission_structures(id),
  
  -- Reason
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(opportunity_id, team_member_id)
);

-- Create indexes
CREATE INDEX idx_user_payment_structures_org ON user_payment_structures(organization_id);
CREATE INDEX idx_user_payment_structures_user ON user_payment_structures(user_id);
CREATE INDEX idx_user_payment_structures_team_member ON user_payment_structures(team_member_id);
CREATE INDEX idx_user_payment_structures_active ON user_payment_structures(is_active, effective_date);

CREATE INDEX idx_user_payment_assignments_org ON user_payment_assignments(organization_id);
CREATE INDEX idx_user_payment_assignments_ghl_user ON user_payment_assignments(ghl_user_id);
CREATE INDEX idx_user_payment_assignments_team_member ON user_payment_assignments(team_member_id);

CREATE INDEX idx_opportunity_cache_org ON opportunity_cache(organization_id);
CREATE INDEX idx_opportunity_cache_opportunity ON opportunity_cache(opportunity_id);
CREATE INDEX idx_opportunity_cache_profit_margin ON opportunity_cache(profit_margin);

CREATE INDEX idx_incoming_messages_org ON incoming_messages(organization_id);
CREATE INDEX idx_incoming_messages_phone ON incoming_messages(phone_normalized);
CREATE INDEX idx_incoming_messages_processed ON incoming_messages(processed, has_receipt);

CREATE INDEX idx_chatbot_settings_bot ON chatbot_settings(bot_id);
CREATE INDEX idx_workflow_checkpoints_workflow ON workflow_checkpoints(workflow_id);
CREATE INDEX idx_workflow_branches_checkpoint ON workflow_branches(checkpoint_id);
CREATE INDEX idx_workflow_actions_checkpoint ON workflow_actions(checkpoint_id);

CREATE INDEX idx_user_commission_structures_org ON user_commission_structures(organization_id);
CREATE INDEX idx_user_commission_structures_team_member ON user_commission_structures(team_member_id);
CREATE INDEX idx_opportunity_commission_overrides_org ON opportunity_commission_overrides(organization_id);
CREATE INDEX idx_opportunity_commission_overrides_opportunity ON opportunity_commission_overrides(opportunity_id);

-- Create triggers
CREATE TRIGGER update_user_payment_structures_updated_at 
  BEFORE UPDATE ON user_payment_structures 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_payment_assignments_updated_at 
  BEFORE UPDATE ON user_payment_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunity_cache_updated_at 
  BEFORE UPDATE ON opportunity_cache 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chatbot_settings_updated_at 
  BEFORE UPDATE ON chatbot_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_checkpoints_updated_at 
  BEFORE UPDATE ON workflow_checkpoints 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_commission_structures_updated_at 
  BEFORE UPDATE ON user_commission_structures 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunity_commission_overrides_updated_at 
  BEFORE UPDATE ON opportunity_commission_overrides 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update opportunity cache totals
CREATE OR REPLACE FUNCTION update_opportunity_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'opportunity_receipts' THEN
    -- Update expense totals
    UPDATE opportunity_cache
    SET total_expenses = (
      SELECT COALESCE(SUM(amount), 0)
      FROM opportunity_receipts
      WHERE opportunity_id = NEW.opportunity_id
    )
    WHERE opportunity_id = NEW.opportunity_id;
  ELSIF TG_TABLE_NAME = 'time_entries' THEN
    -- Update labor cost totals
    UPDATE opportunity_cache
    SET total_labor_cost = (
      SELECT COALESCE(SUM(hours_worked * hourly_rate), 0)
      FROM time_entries
      WHERE opportunity_id = NEW.opportunity_id
    )
    WHERE opportunity_id = NEW.opportunity_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opportunity_expenses 
  AFTER INSERT OR UPDATE OR DELETE ON opportunity_receipts
  FOR EACH ROW EXECUTE FUNCTION update_opportunity_totals();

CREATE TRIGGER update_opportunity_labor 
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_opportunity_totals();

-- Enable RLS
ALTER TABLE user_payment_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_commission_overrides ENABLE ROW LEVEL SECURITY;