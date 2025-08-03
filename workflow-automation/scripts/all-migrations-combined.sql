
-- ========================================
-- Migration: 001_initial_setup.sql
-- ========================================
-- 001_initial_setup.sql
-- Core extensions and helper functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate payout numbers
CREATE OR REPLACE FUNCTION generate_payout_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the last payout number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(payout_number FROM 'PAY-\d{4}-(\d{3})') AS INTEGER)), 0)
  INTO last_number
  FROM commission_payouts
  WHERE payout_number LIKE 'PAY-' || current_year || '-%';
  
  -- Generate new number
  new_number := 'PAY-' || current_year || '-' || LPAD((last_number + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- Migration: 002_organizations_and_auth.sql
-- ========================================
-- 002_organizations_and_auth.sql
-- Multi-tenancy foundation: Organizations, roles, and team management

-- 1. Organizations table (master account structure)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  
  -- Subscription and billing
  subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'inactive', 'cancelled')),
  subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  -- Usage limits based on plan
  max_users INTEGER DEFAULT 1,
  max_workflows INTEGER DEFAULT 5,
  max_bots INTEGER DEFAULT 1,
  max_contacts INTEGER DEFAULT 1000,
  max_monthly_messages INTEGER DEFAULT 10000,
  
  -- Current usage tracking
  current_users INTEGER DEFAULT 0,
  current_workflows INTEGER DEFAULT 0,
  current_bots INTEGER DEFAULT 0,
  current_contacts INTEGER DEFAULT 0,
  current_monthly_messages INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', NOW() + INTERVAL '1 month'),
  
  -- Organization settings
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  is_active BOOLEAN DEFAULT true
);

-- 2. Users table (synced from Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Organization members (link users to organizations with roles)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role-based access
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'administrator', 'sales', 'bot_trainer', 'viewer')),
  
  -- Permissions override
  custom_permissions JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- 4. Team members (all people in the organization, including non-users)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Member information
  external_id VARCHAR(255), -- For GHL user IDs or other external systems
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Link to platform user (if they have login access)
  user_id UUID REFERENCES users(id),
  organization_member_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Member type and status
  member_type VARCHAR(50) DEFAULT 'sales' CHECK (member_type IN ('sales', 'support', 'operations', 'management')),
  is_active BOOLEAN DEFAULT true,
  
  -- Commission and payment settings
  commission_rate DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_type VARCHAR(50) DEFAULT 'gross' CHECK (commission_type IN ('gross', 'profit', 'tiered', 'flat')),
  payment_structure JSONB DEFAULT '{}',
  
  -- Payment information
  bank_routing TEXT,
  bank_account TEXT,
  payment_method VARCHAR(50) CHECK (payment_method IN ('direct_deposit', 'check', 'paypal', 'wire', 'other')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, email),
  UNIQUE(organization_id, external_id)
);

-- 5. Role permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, resource)
);

-- Insert default role permissions
INSERT INTO role_permissions (role, resource, actions) VALUES
-- Owner: Full access
('owner', 'organizations', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'members', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'workflows', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'bots', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'integrations', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'sales', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'commissions', '["create", "read", "update", "delete", "approve"]'::jsonb),
('owner', 'billing', '["read", "update"]'::jsonb),

-- Administrator: Almost full access
('administrator', 'organizations', '["read", "update"]'::jsonb),
('administrator', 'members', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'workflows', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'bots', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'integrations', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'sales', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'commissions', '["create", "read", "update", "delete", "approve"]'::jsonb),

-- Sales: GHL features and sales access
('sales', 'sales', '["create", "read", "update"]'::jsonb),
('sales', 'commissions', '["read"]'::jsonb),
('sales', 'contacts', '["create", "read", "update"]'::jsonb),
('sales', 'opportunities', '["create", "read", "update"]'::jsonb),
('sales', 'receipts', '["create", "read", "update"]'::jsonb),

-- Bot Trainer: Bot and workflow access
('bot_trainer', 'bots', '["create", "read", "update"]'::jsonb),
('bot_trainer', 'workflows', '["create", "read", "update"]'::jsonb),
('bot_trainer', 'conversations', '["read"]'::jsonb),

-- Viewer: Read-only
('viewer', 'organizations', '["read"]'::jsonb),
('viewer', 'workflows', '["read"]'::jsonb),
('viewer', 'bots', '["read"]'::jsonb),
('viewer', 'sales', '["read"]'::jsonb),
('viewer', 'commissions', '["read"]'::jsonb);

-- Create indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_status ON organization_members(status);

CREATE INDEX idx_team_members_org ON team_members(organization_id);
CREATE INDEX idx_team_members_email ON team_members(organization_id, email);
CREATE INDEX idx_team_members_external ON team_members(organization_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_team_members_user ON team_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_team_members_active ON team_members(organization_id, is_active) WHERE is_active = true;

-- Create triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Migration: 003_core_platform_tables.sql
-- ========================================
-- 003_core_platform_tables.sql
-- Core workflow automation platform tables

-- 1. Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  version INTEGER DEFAULT 1
);

-- 2. Workflow versions
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  change_description TEXT,
  UNIQUE(workflow_id, version_number)
);

-- 3. Executions table
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  logs JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  input_data JSONB,
  output_data JSONB,
  credits_used INTEGER DEFAULT 1,
  triggered_by UUID REFERENCES users(id)
);

-- 4. Integrations table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB, -- Encrypted credentials
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- OAuth tokens for services like GoHighLevel
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'error', 'completed')),
  
  UNIQUE(organization_id, type, name)
);

-- 5. API Keys table (organization-level)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL, -- Store hashed API key
  key_prefix TEXT NOT NULL, -- First few characters for identification
  service TEXT NOT NULL,
  permissions JSONB DEFAULT '[]',
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(organization_id, name)
);

-- 6. User API Keys (for external services like OpenAI)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  UNIQUE(organization_id, service)
);

-- 7. Workflow templates
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  definition JSONB NOT NULL,
  preview_image_url TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id) -- NULL for system templates
);

-- Create indexes
CREATE INDEX idx_workflows_org ON workflows(organization_id);
CREATE INDEX idx_workflows_active ON workflows(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_executions_org ON executions(organization_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_started_at ON executions(started_at DESC);
CREATE INDEX idx_integrations_org ON integrations(organization_id);
CREATE INDEX idx_integrations_type ON integrations(organization_id, type);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_service ON api_keys(organization_id, service);
CREATE INDEX idx_user_api_keys_org ON user_api_keys(organization_id);
CREATE INDEX idx_user_api_keys_service ON user_api_keys(organization_id, service);
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_featured ON workflow_templates(is_featured) WHERE is_featured = true;

-- Create triggers
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create workflow version trigger
CREATE OR REPLACE FUNCTION create_workflow_version()
RETURNS TRIGGER AS $$
DECLARE
  v_version_number INTEGER;
BEGIN
  -- Only create version if definition changed
  IF OLD.definition IS DISTINCT FROM NEW.definition THEN
    -- Get the next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM workflow_versions
    WHERE workflow_id = NEW.id;
    
    -- Insert new version
    INSERT INTO workflow_versions (workflow_id, organization_id, version_number, definition, created_by)
    VALUES (NEW.id, NEW.organization_id, v_version_number, OLD.definition, NEW.created_by);
    
    -- Update version number in workflows table
    NEW.version := v_version_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_workflow_version_trigger
  AFTER UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_version();

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Migration: 004_gohighlevel_integration.sql
-- ========================================
-- 004_gohighlevel_integration.sql
-- GoHighLevel integration tables for contacts, opportunities, and receipts

-- 1. Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_contact_id VARCHAR(255) NOT NULL,
  ghl_location_id VARCHAR(255) NOT NULL,
  
  -- Contact information
  email VARCHAR(255),
  phone VARCHAR(50),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(255),
  company_name VARCHAR(255),
  
  -- Address
  address1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  
  -- Additional fields
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  source VARCHAR(255),
  
  -- Sync metadata
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'synced',
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ghl_created_at TIMESTAMP WITH TIME ZONE,
  ghl_updated_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(integration_id, ghl_contact_id)
);

-- 2. Contact sync logs
CREATE TABLE contact_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook', 'manual')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  total_contacts INTEGER DEFAULT 0,
  synced_contacts INTEGER DEFAULT 0,
  failed_contacts INTEGER DEFAULT 0,
  
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Pipeline stages
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_pipeline_id VARCHAR(255) NOT NULL,
  ghl_stage_id VARCHAR(255) NOT NULL,
  
  -- Stage information
  pipeline_name VARCHAR(255) NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  stage_position INTEGER,
  
  -- Analysis fields
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_status VARCHAR(50) CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'error')),
  completion_percentage DECIMAL(5,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, ghl_pipeline_id, ghl_stage_id)
);

-- 4. Opportunity receipts
CREATE TABLE opportunity_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identifiers
  opportunity_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255),
  
  -- Receipt details
  amount DECIMAL(10,2) NOT NULL,
  receipt_date DATE NOT NULL,
  receipt_type VARCHAR(50) CHECK (receipt_type IN ('expense', 'mileage', 'other')),
  category VARCHAR(100),
  description TEXT,
  
  -- Image storage
  image_url TEXT,
  thumbnail_url TEXT,
  
  -- Reimbursable flag and processing
  is_reimbursable BOOLEAN DEFAULT false,
  reimbursement_status VARCHAR(50) DEFAULT 'pending' CHECK (
    reimbursement_status IN ('pending', 'approved', 'paid', 'rejected')
  ),
  
  -- Team member assignment
  team_member_id UUID REFERENCES team_members(id),
  submitted_by_name VARCHAR(255),
  submitted_by_phone VARCHAR(50),
  
  -- AI processing
  ai_extracted_data JSONB,
  ai_confidence_score DECIMAL(3,2),
  manual_review_required BOOLEAN DEFAULT false,
  
  -- Company credit card tracking
  company_card_id UUID,
  is_company_card_expense BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 5. Receipt processing log
CREATE TABLE receipt_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Source information
  source VARCHAR(50) NOT NULL CHECK (source IN ('web_upload', 'sms', 'email', 'api')),
  phone_number VARCHAR(50),
  email VARCHAR(255),
  
  -- Message details (for SMS/email)
  message_id VARCHAR(255),
  message_text TEXT,
  attachment_id VARCHAR(255),
  attachment_url TEXT,
  
  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')
  ),
  
  -- AI processing results
  ai_response TEXT,
  extracted_data JSONB,
  potential_matches JSONB DEFAULT '[]',
  
  -- Response handling
  response_message TEXT,
  response_sent BOOLEAN DEFAULT false,
  response_sent_at TIMESTAMP WITH TIME ZONE,
  response_error TEXT,
  ghl_message_response JSONB,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Receipt reference
  receipt_id UUID REFERENCES opportunity_receipts(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Time entries
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id VARCHAR(255) NOT NULL,
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  
  -- Time tracking
  date DATE NOT NULL,
  hours_worked DECIMAL(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  
  -- Work details
  work_type VARCHAR(100),
  description TEXT,
  
  -- Billing
  hourly_rate DECIMAL(10,2),
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  is_billable BOOLEAN DEFAULT true,
  
  -- Status
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected')
  ),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 7. Company credit cards
CREATE TABLE company_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Card details
  card_name VARCHAR(255) NOT NULL,
  last_four VARCHAR(4) NOT NULL,
  card_type VARCHAR(50), -- visa, mastercard, amex, etc
  
  -- Assignment
  assigned_to UUID REFERENCES team_members(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, last_four)
);

-- Create indexes
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_integration ON contacts(integration_id);
CREATE INDEX idx_contacts_ghl_id ON contacts(ghl_contact_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);

CREATE INDEX idx_contact_sync_logs_org ON contact_sync_logs(organization_id);
CREATE INDEX idx_contact_sync_logs_integration ON contact_sync_logs(integration_id);

CREATE INDEX idx_pipeline_stages_org ON pipeline_stages(organization_id);
CREATE INDEX idx_pipeline_stages_integration ON pipeline_stages(integration_id);

CREATE INDEX idx_opportunity_receipts_org ON opportunity_receipts(organization_id);
CREATE INDEX idx_opportunity_receipts_opportunity ON opportunity_receipts(opportunity_id);
CREATE INDEX idx_opportunity_receipts_team_member ON opportunity_receipts(team_member_id);
CREATE INDEX idx_opportunity_receipts_reimbursable ON opportunity_receipts(is_reimbursable) WHERE is_reimbursable = true;

CREATE INDEX idx_receipt_processing_log_org ON receipt_processing_log(organization_id);
CREATE INDEX idx_receipt_processing_log_status ON receipt_processing_log(processing_status);
CREATE INDEX idx_receipt_processing_log_phone ON receipt_processing_log(phone_number) WHERE phone_number IS NOT NULL;

CREATE INDEX idx_time_entries_org ON time_entries(organization_id);
CREATE INDEX idx_time_entries_opportunity ON time_entries(opportunity_id);
CREATE INDEX idx_time_entries_team_member ON time_entries(team_member_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);

CREATE INDEX idx_company_credit_cards_org ON company_credit_cards(organization_id);
CREATE INDEX idx_company_credit_cards_assigned ON company_credit_cards(assigned_to) WHERE assigned_to IS NOT NULL;

-- Create triggers
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunity_receipts_updated_at BEFORE UPDATE ON opportunity_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_credit_cards_updated_at BEFORE UPDATE ON company_credit_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages DISABLE ROW LEVEL SECURITY; -- Disabled as per original migration
ALTER TABLE opportunity_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_credit_cards ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Migration: 005_sales_and_commissions.sql
-- ========================================
-- 005_sales_and_commissions.sql
-- Comprehensive sales tracking, products, and commission system

-- 1. GHL Products table
CREATE TABLE ghl_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_product_id VARCHAR NOT NULL,
  
  -- Product details
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  price_type VARCHAR(50) CHECK (price_type IN ('one_time', 'recurring')),
  recurring_interval VARCHAR(50) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly', NULL)),
  recurring_interval_count INTEGER DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, ghl_product_id)
);

-- 2. Sales transactions table
CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL References
  opportunity_id VARCHAR NOT NULL,
  contact_id VARCHAR NOT NULL,
  product_id UUID REFERENCES ghl_products(id),
  ghl_invoice_id VARCHAR,
  ghl_payment_id VARCHAR,
  ghl_transaction_id VARCHAR,
  
  -- Transaction details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) NOT NULL CHECK (
    payment_status IN ('completed', 'pending', 'failed', 'refunded', 'partially_refunded')
  ),
  transaction_type VARCHAR(50) NOT NULL CHECK (
    transaction_type IN ('sale', 'subscription_initial', 'subscription_renewal', 'refund', 'partial_refund')
  ),
  
  -- Subscription tracking
  subscription_id VARCHAR,
  subscription_period_start DATE,
  subscription_period_end DATE,
  is_first_payment BOOLEAN DEFAULT false,
  
  -- Team member assignment
  team_member_id UUID REFERENCES team_members(id),
  
  -- Additional data
  raw_webhook_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, ghl_payment_id)
);

-- 3. Commission structures (default rates per team member)
CREATE TABLE commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Commission settings
  commission_type VARCHAR(50) NOT NULL CHECK (
    commission_type IN ('gross', 'profit', 'tiered', 'flat', 'hybrid')
  ),
  
  -- Standard rates
  base_commission_rate DECIMAL(5,2) CHECK (base_commission_rate >= 0 AND base_commission_rate <= 100),
  subscription_initial_rate DECIMAL(5,2) CHECK (subscription_initial_rate >= 0 AND subscription_initial_rate <= 100),
  subscription_renewal_rate DECIMAL(5,2) CHECK (subscription_renewal_rate >= 0 AND subscription_renewal_rate <= 100),
  
  -- Tiered commission structure
  tiers JSONB DEFAULT '[]', -- Array of {min_amount, max_amount, rate}
  
  -- Additional settings
  applies_to_products JSONB DEFAULT '[]', -- Array of product IDs, empty = all products
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(team_member_id, effective_date)
);

-- 4. Commission rules (product or category specific)
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule scope
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'category', 'global')),
  
  -- Targeting
  product_ids JSONB DEFAULT '[]', -- Specific products
  categories JSONB DEFAULT '[]', -- Product categories
  team_member_ids JSONB DEFAULT '[]', -- Specific team members, empty = all
  
  -- Commission settings
  commission_type VARCHAR(50) NOT NULL CHECK (
    commission_type IN ('gross', 'profit', 'fixed', 'override')
  ),
  commission_value DECIMAL(10,2) NOT NULL, -- Percentage or fixed amount
  
  -- Rule conditions
  conditions JSONB DEFAULT '{}', -- e.g., {min_sale_amount: 1000}
  
  -- Priority and status
  priority INTEGER DEFAULT 0, -- Higher priority rules apply first
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, rule_name)
);

-- 5. Commission calculations
CREATE TABLE commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Commission details
  commission_type VARCHAR(50) NOT NULL,
  commission_percentage DECIMAL(5,2),
  commission_tier VARCHAR(50),
  base_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Rule tracking
  applied_structure_id UUID REFERENCES commission_structures(id),
  applied_rule_id UUID REFERENCES commission_rules(id),
  
  -- Profit calculation fields
  revenue_amount DECIMAL(10,2),
  expense_amount DECIMAL(10,2),
  profit_amount DECIMAL(10,2),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'paid', 'cancelled', 'on_hold')
  ),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Subscription verification
  requires_payment_verification BOOLEAN DEFAULT false,
  verification_status VARCHAR(50) CHECK (verification_status IN ('pending', 'verified', 'failed', NULL)),
  verification_date TIMESTAMP WITH TIME ZONE,
  next_verification_date DATE,
  
  -- Payout reference
  payout_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Commission payouts
CREATE TABLE commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Payout details
  payout_number VARCHAR UNIQUE,
  payout_date DATE NOT NULL,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment information
  payment_method VARCHAR(50) CHECK (
    payment_method IN ('direct_deposit', 'check', 'paypal', 'wire', 'other')
  ),
  payment_reference VARCHAR,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Summary stats
  commission_count INTEGER DEFAULT 0,
  total_sales_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Administrative
  generated_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Payout line items
CREATE TABLE payout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES commission_calculations(id),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id),
  
  -- Line item details
  opportunity_id VARCHAR NOT NULL,
  opportunity_name VARCHAR,
  contact_id VARCHAR NOT NULL,
  contact_name VARCHAR,
  product_name VARCHAR,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2),
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Additional context
  transaction_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Pipeline stage analysis (for completion tracking)
CREATE TABLE pipeline_stage_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  
  -- Movement tracking
  entered_stage_at TIMESTAMP WITH TIME ZONE NOT NULL,
  exited_stage_at TIMESTAMP WITH TIME ZONE,
  time_in_stage INTERVAL GENERATED ALWAYS AS (
    exited_stage_at - entered_stage_at
  ) STORED, -- NULL for active stages; calculate with NOW() - entered_stage_at in queries
  
  -- Completion status
  is_completed BOOLEAN DEFAULT false,
  completion_type VARCHAR(50) CHECK (
    completion_type IN ('moved_forward', 'moved_backward', 'won', 'lost', NULL)
  ),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ghl_products_org ON ghl_products(organization_id);
CREATE INDEX idx_ghl_products_integration ON ghl_products(integration_id);
CREATE INDEX idx_ghl_products_ghl_id ON ghl_products(ghl_product_id);
CREATE INDEX idx_ghl_products_active ON ghl_products(is_active) WHERE is_active = true;

CREATE INDEX idx_sales_transactions_org ON sales_transactions(organization_id);
CREATE INDEX idx_sales_transactions_opportunity ON sales_transactions(opportunity_id);
CREATE INDEX idx_sales_transactions_contact ON sales_transactions(contact_id);
CREATE INDEX idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX idx_sales_transactions_payment_date ON sales_transactions(payment_date);
CREATE INDEX idx_sales_transactions_team_member ON sales_transactions(team_member_id);

CREATE INDEX idx_commission_structures_org ON commission_structures(organization_id);
CREATE INDEX idx_commission_structures_team_member ON commission_structures(team_member_id);
CREATE INDEX idx_commission_structures_active ON commission_structures(is_active, effective_date);

CREATE INDEX idx_commission_rules_org ON commission_rules(organization_id);
CREATE INDEX idx_commission_rules_active ON commission_rules(is_active, priority);

CREATE INDEX idx_commission_calculations_org ON commission_calculations(organization_id);
CREATE INDEX idx_commission_calculations_transaction ON commission_calculations(transaction_id);
CREATE INDEX idx_commission_calculations_team_member ON commission_calculations(team_member_id);
CREATE INDEX idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX idx_commission_calculations_payout ON commission_calculations(payout_id) WHERE payout_id IS NOT NULL;

CREATE INDEX idx_commission_payouts_org ON commission_payouts(organization_id);
CREATE INDEX idx_commission_payouts_team_member ON commission_payouts(team_member_id);
CREATE INDEX idx_commission_payouts_payout_number ON commission_payouts(payout_number);
CREATE INDEX idx_commission_payouts_status ON commission_payouts(payment_status);

CREATE INDEX idx_payout_line_items_payout ON payout_line_items(payout_id);
CREATE INDEX idx_payout_line_items_commission ON payout_line_items(commission_id);

CREATE INDEX idx_pipeline_stage_analysis_org ON pipeline_stage_analysis(organization_id);
CREATE INDEX idx_pipeline_stage_analysis_stage ON pipeline_stage_analysis(pipeline_stage_id);
CREATE INDEX idx_pipeline_stage_analysis_opportunity ON pipeline_stage_analysis(opportunity_id);

-- Create triggers
CREATE TRIGGER update_ghl_products_updated_at BEFORE UPDATE ON ghl_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_transactions_updated_at BEFORE UPDATE ON sales_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_structures_updated_at BEFORE UPDATE ON commission_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_rules_updated_at BEFORE UPDATE ON commission_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_calculations_updated_at BEFORE UPDATE ON commission_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_payouts_updated_at BEFORE UPDATE ON commission_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ghl_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_analysis ENABLE ROW LEVEL SECURITY;

-- Add foreign key for payout_id after commission_payouts is created
ALTER TABLE commission_calculations 
  ADD CONSTRAINT fk_commission_calculations_payout 
  FOREIGN KEY (payout_id) REFERENCES commission_payouts(id);


-- ========================================
-- Migration: 006_chatbot_system.sql
-- ========================================
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


-- ========================================
-- Migration: 007_mcp_integration.sql
-- ========================================
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


-- ========================================
-- Migration: 008_rls_policies.sql
-- ========================================
-- 008_rls_policies.sql
-- Row Level Security policies for all tables

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND organization_members.user_id = user_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_org_role(org_id UUID, required_roles TEXT[], user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND organization_members.user_id = user_id
    AND role = ANY(required_roles)
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_resource(org_id UUID, resource TEXT, action TEXT, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM organization_members
  WHERE organization_id = org_id
  AND organization_members.user_id = user_id
  AND status = 'active';
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = user_role
    AND role_permissions.resource = resource
    AND actions @> to_jsonb(action)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_organization_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM organization_members
  WHERE user_id = p_user_id
  AND status = 'active'
  LIMIT 1;
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_org_member TO authenticated;
GRANT EXECUTE ON FUNCTION has_org_role TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_resource TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_id TO authenticated;

-- ORGANIZATIONS POLICIES
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "Owners and admins can update organizations" ON organizations
  FOR UPDATE USING (has_org_role(id, ARRAY['owner', 'administrator']));

-- USERS POLICIES
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- ORGANIZATION MEMBERS POLICIES
CREATE POLICY "Members can view their organization members" ON organization_members
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Owners and admins can manage members" ON organization_members
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner', 'administrator']));

-- TEAM MEMBERS POLICIES
CREATE POLICY "Organization members can view team members" ON team_members
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage team members" ON team_members
  FOR ALL USING (has_org_role(organization_id, ARRAY['owner', 'administrator']));

-- ROLE PERMISSIONS POLICIES
CREATE POLICY "All users can view role permissions" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- WORKFLOWS POLICIES
CREATE POLICY "Org members can view workflows" ON workflows
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can create workflows" ON workflows
  FOR INSERT WITH CHECK (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'workflows', 'create')
  );

CREATE POLICY "Authorized users can update workflows" ON workflows
  FOR UPDATE USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'workflows', 'update')
  );

CREATE POLICY "Authorized users can delete workflows" ON workflows
  FOR DELETE USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'workflows', 'delete')
  );

-- EXECUTIONS POLICIES
CREATE POLICY "Org members can view executions" ON executions
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can create executions" ON executions
  FOR INSERT WITH CHECK (is_org_member(organization_id));

-- INTEGRATIONS POLICIES
CREATE POLICY "Org members can view integrations" ON integrations
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage integrations" ON integrations
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'integrations', 'update')
  );

-- API KEYS POLICIES
CREATE POLICY "Org members can view API keys" ON api_keys
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage API keys" ON api_keys
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- USER API KEYS POLICIES
CREATE POLICY "Org members can view user API keys" ON user_api_keys
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage user API keys" ON user_api_keys
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- WORKFLOW TEMPLATES POLICIES
CREATE POLICY "All users can view public templates" ON workflow_templates
  FOR SELECT USING (is_public = true OR (organization_id IS NOT NULL AND is_org_member(organization_id)));

-- CONTACTS POLICIES
CREATE POLICY "Org members can view contacts" ON contacts
  FOR SELECT USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'contacts', 'read')
  );

CREATE POLICY "Authorized users can manage contacts" ON contacts
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'contacts', 'update')
  );

-- OPPORTUNITY RECEIPTS POLICIES
CREATE POLICY "Sales users can view receipts" ON opportunity_receipts
  FOR SELECT USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'receipts', 'read')
  );

CREATE POLICY "Sales users can manage receipts" ON opportunity_receipts
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'receipts', 'update')
  );

-- TIME ENTRIES POLICIES
CREATE POLICY "View time entries" ON time_entries
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      team_member_id IN (
        SELECT id FROM team_members 
        WHERE organization_id = time_entries.organization_id
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Manage time entries" ON time_entries
  FOR ALL USING (
    is_org_member(organization_id) AND (
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      team_member_id IN (
        SELECT id FROM team_members 
        WHERE organization_id = time_entries.organization_id
        AND user_id = auth.uid()
      )
    )
  );

-- COMPANY CREDIT CARDS POLICIES
CREATE POLICY "Authorized users can view credit cards" ON company_credit_cards
  FOR SELECT USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

CREATE POLICY "Owners can manage credit cards" ON company_credit_cards
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner'])
  );

-- SALES TRANSACTIONS POLICIES
CREATE POLICY "Org members can view sales transactions" ON sales_transactions
  FOR SELECT USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'sales', 'read')
  );

CREATE POLICY "Authorized users can manage sales transactions" ON sales_transactions
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'sales', 'update')
  );

-- COMMISSION CALCULATIONS POLICIES
CREATE POLICY "View commission calculations" ON commission_calculations
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      (can_access_resource(organization_id, 'commissions', 'read') AND 
       team_member_id IN (
         SELECT id FROM team_members 
         WHERE organization_id = commission_calculations.organization_id
         AND user_id = auth.uid()
       ))
    )
  );

CREATE POLICY "Manage commission calculations" ON commission_calculations
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- COMMISSION PAYOUTS POLICIES
CREATE POLICY "View commission payouts" ON commission_payouts
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      (can_access_resource(organization_id, 'commissions', 'read') AND 
       team_member_id IN (
         SELECT id FROM team_members 
         WHERE organization_id = commission_payouts.organization_id
         AND user_id = auth.uid()
       ))
    )
  );

CREATE POLICY "Manage commission payouts" ON commission_payouts
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'commissions', 'approve')
  );

-- GHL PRODUCTS POLICIES
CREATE POLICY "Org members can view products" ON ghl_products
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage products" ON ghl_products
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'sales', 'update')
  );

-- BOTS POLICIES
CREATE POLICY "Org members can view bots" ON bots
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage bots" ON bots
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'bots', 'update')
  );

-- CHATBOT WORKFLOWS POLICIES
CREATE POLICY "Org members can view chatbot workflows" ON chatbot_workflows
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage chatbot workflows" ON chatbot_workflows
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'workflows', 'update')
  );

-- CONVERSATION SESSIONS POLICIES
CREATE POLICY "Org members can view conversation sessions" ON conversation_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = conversation_sessions.bot_id
      AND is_org_member(bots.organization_id)
    )
  );

CREATE POLICY "Public can create conversation sessions" ON conversation_sessions
  FOR INSERT WITH CHECK (true); -- Public access for chatbot conversations

-- MCP INTEGRATIONS POLICIES
CREATE POLICY "Org members can view MCP integrations" ON mcp_integrations
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage MCP integrations" ON mcp_integrations
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- MCP TOOLS POLICIES
CREATE POLICY "All authenticated users can view MCP tools" ON mcp_tools
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- MCP TOOL EXECUTIONS POLICIES
CREATE POLICY "Org members can view their MCP executions" ON mcp_tool_executions
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can create MCP executions" ON mcp_tool_executions
  FOR INSERT WITH CHECK (is_org_member(organization_id));

-- PAYOUT LINE ITEMS POLICIES (depends on payouts access)
CREATE POLICY "Users can view payout line items" ON payout_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_payouts 
      WHERE commission_payouts.id = payout_line_items.payout_id 
      AND is_org_member(commission_payouts.organization_id)
    )
  );

-- REMAINING TABLE POLICIES (simple org membership check)
CREATE POLICY "Org members can view workflow versions" ON workflow_versions
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can view contact sync logs" ON contact_sync_logs
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can view receipt processing logs" ON receipt_processing_log
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can view commission structures" ON commission_structures
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage commission structures" ON commission_structures
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

CREATE POLICY "Org members can view commission rules" ON commission_rules
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage commission rules" ON commission_rules
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

CREATE POLICY "Org members can view pipeline stage analysis" ON pipeline_stage_analysis
  FOR SELECT USING (is_org_member(organization_id));

-- BOT WORKFLOWS JUNCTION TABLE POLICIES
CREATE POLICY "Org members can view bot workflows" ON bot_workflows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_workflows.bot_id
      AND is_org_member(bots.organization_id)
    )
  );

CREATE POLICY "Authorized users can manage bot workflows" ON bot_workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_workflows.bot_id
      AND is_org_member(bots.organization_id)
      AND can_access_resource(bots.organization_id, 'bots', 'update')
    )
  );

-- WORKFLOW NODES POLICIES
CREATE POLICY "Org members can view workflow nodes" ON workflow_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chatbot_workflows
      WHERE chatbot_workflows.id = workflow_nodes.workflow_id
      AND is_org_member(chatbot_workflows.organization_id)
    )
  );

CREATE POLICY "Authorized users can manage workflow nodes" ON workflow_nodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chatbot_workflows
      WHERE chatbot_workflows.id = workflow_nodes.workflow_id
      AND is_org_member(chatbot_workflows.organization_id)
      AND can_access_resource(chatbot_workflows.organization_id, 'workflows', 'update')
    )
  );

-- REMAINING CHATBOT TABLE POLICIES
CREATE POLICY "Org members can view workflow connections" ON workflow_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chatbot_workflows
      WHERE chatbot_workflows.id = workflow_connections.workflow_id
      AND is_org_member(chatbot_workflows.organization_id)
    )
  );

CREATE POLICY "Org members can view conversation messages" ON conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions cs
      JOIN bots b ON cs.bot_id = b.id
      WHERE cs.id = conversation_messages.session_id
      AND is_org_member(b.organization_id)
    )
  );

CREATE POLICY "Public can create conversation messages" ON conversation_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Org members can view workflow goal evaluations" ON workflow_goal_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions cs
      JOIN bots b ON cs.bot_id = b.id
      WHERE cs.id = workflow_goal_evaluations.session_id
      AND is_org_member(b.organization_id)
    )
  );

CREATE POLICY "Org members can view workflow actions log" ON workflow_actions_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions cs
      JOIN bots b ON cs.bot_id = b.id
      WHERE cs.id = workflow_actions_log.session_id
      AND is_org_member(b.organization_id)
    )
  );

CREATE POLICY "Org members can view bot knowledge base" ON bot_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_knowledge_base.bot_id
      AND is_org_member(bots.organization_id)
    )
  );

CREATE POLICY "Authorized users can manage bot knowledge base" ON bot_knowledge_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_knowledge_base.bot_id
      AND is_org_member(bots.organization_id)
      AND can_access_resource(bots.organization_id, 'bots', 'update')
    )
  );

CREATE POLICY "Org members can view appointment bookings" ON appointment_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions cs
      JOIN bots b ON cs.bot_id = b.id
      WHERE cs.id = appointment_bookings.session_id
      AND is_org_member(b.organization_id)
    )
  );

CREATE POLICY "Org members can view chat sessions" ON chat_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = chat_sessions.bot_id
      AND is_org_member(bots.organization_id)
    )
  );

CREATE POLICY "Public can create chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (true);


-- ========================================
-- Migration: 009_views_and_functions.sql
-- ========================================
-- 009_views_and_functions.sql
-- Useful views and functions for the application

-- 1. User organization view
CREATE OR REPLACE VIEW user_organization_view AS
SELECT 
  om.user_id,
  om.organization_id,
  om.role,
  o.name as organization_name,
  o.slug as organization_slug,
  o.subscription_status,
  o.subscription_plan,
  o.trial_ends_at,
  o.subscription_ends_at
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.status = 'active';

-- 2. Commission dashboard view
CREATE OR REPLACE VIEW commission_dashboard AS
SELECT 
  cc.id,
  cc.organization_id,
  cc.team_member_id,
  tm.full_name as team_member_name,
  tm.email as team_member_email,
  cc.opportunity_id,
  cc.commission_type,
  cc.commission_percentage,
  cc.commission_amount,
  cc.status,
  cc.created_at,
  st.amount as sale_amount,
  st.payment_date,
  st.transaction_type,
  st.contact_id,
  gp.name as product_name,
  cp.payout_number,
  cp.payment_status as payout_status
FROM commission_calculations cc
JOIN sales_transactions st ON cc.transaction_id = st.id
JOIN team_members tm ON cc.team_member_id = tm.id
LEFT JOIN ghl_products gp ON st.product_id = gp.id
LEFT JOIN commission_payouts cp ON cc.payout_id = cp.id;

-- 3. Active integrations view
CREATE OR REPLACE VIEW active_integrations_view AS
SELECT 
  i.id,
  i.organization_id,
  i.type,
  i.name,
  i.is_active,
  i.last_sync_at,
  i.sync_status,
  CASE 
    WHEN i.token_expires_at IS NOT NULL THEN 
      CASE 
        WHEN i.token_expires_at < NOW() THEN 'expired'
        WHEN i.token_expires_at < NOW() + INTERVAL '1 day' THEN 'expiring_soon'
        ELSE 'valid'
      END
    ELSE 'no_expiry'
  END as token_status,
  i.created_at
FROM integrations i
WHERE i.is_active = true;

-- 4. Receipt processing summary view
CREATE OR REPLACE VIEW receipt_processing_summary AS
SELECT 
  rpl.organization_id,
  DATE(rpl.created_at) as processing_date,
  COUNT(*) as total_receipts,
  COUNT(CASE WHEN rpl.processing_status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN rpl.processing_status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN rpl.processing_status = 'manual_review' THEN 1 END) as manual_review,
  COUNT(CASE WHEN rpl.source = 'sms' THEN 1 END) as from_sms,
  COUNT(CASE WHEN rpl.source = 'web_upload' THEN 1 END) as from_web
FROM receipt_processing_log rpl
GROUP BY rpl.organization_id, DATE(rpl.created_at);

-- 5. Team member commission summary view
CREATE OR REPLACE VIEW team_member_commission_summary AS
SELECT 
  tm.id as team_member_id,
  tm.organization_id,
  tm.full_name,
  tm.email,
  COUNT(DISTINCT cc.id) as total_commissions,
  SUM(cc.commission_amount) as total_earned,
  SUM(CASE WHEN cc.status = 'paid' THEN cc.commission_amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN cc.status = 'pending' THEN cc.commission_amount ELSE 0 END) as total_pending,
  MAX(cc.created_at) as last_commission_date
FROM team_members tm
LEFT JOIN commission_calculations cc ON tm.id = cc.team_member_id
GROUP BY tm.id, tm.organization_id, tm.full_name, tm.email;

-- 6. Bot conversation metrics view
CREATE OR REPLACE VIEW bot_conversation_metrics AS
SELECT 
  b.id as bot_id,
  b.organization_id,
  b.name as bot_name,
  COUNT(DISTINCT cs.id) as total_conversations,
  COUNT(DISTINCT cs.contact_id) as unique_contacts,
  COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_conversations,
  COUNT(CASE WHEN cs.status = 'abandoned' THEN 1 END) as abandoned_conversations,
  AVG(EXTRACT(EPOCH FROM (cs.completed_at - cs.started_at))/60) as avg_conversation_duration_minutes,
  MAX(cs.started_at) as last_conversation_date
FROM bots b
LEFT JOIN conversation_sessions cs ON b.id = cs.bot_id
GROUP BY b.id, b.organization_id, b.name;

-- 7. Calculate commission function
CREATE OR REPLACE FUNCTION calculate_commission_amount(
  p_transaction_id UUID,
  p_team_member_id UUID
)
RETURNS TABLE (
  base_amount DECIMAL,
  commission_amount DECIMAL,
  commission_rate DECIMAL,
  commission_type VARCHAR,
  applied_rule_id UUID
) AS $$
DECLARE
  v_transaction RECORD;
  v_base_amount DECIMAL;
  v_commission_amount DECIMAL;
  v_commission_rate DECIMAL;
  v_commission_type VARCHAR;
  v_applied_rule_id UUID;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM sales_transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- First check for specific commission rules
  SELECT 
    cr.commission_value,
    cr.commission_type,
    cr.id
  INTO 
    v_commission_rate,
    v_commission_type,
    v_applied_rule_id
  FROM commission_rules cr
  WHERE cr.organization_id = v_transaction.organization_id
    AND cr.is_active = true
    AND (cr.team_member_ids = '[]'::jsonb OR cr.team_member_ids @> to_jsonb(p_team_member_id::text))
    AND (cr.product_ids = '[]'::jsonb OR cr.product_ids @> to_jsonb(v_transaction.product_id::text))
    AND CURRENT_DATE BETWEEN COALESCE(cr.effective_date, CURRENT_DATE) AND COALESCE(cr.expiry_date, CURRENT_DATE)
  ORDER BY cr.priority DESC
  LIMIT 1;
  
  -- If no specific rule, use team member's default commission structure
  IF v_applied_rule_id IS NULL THEN
    SELECT 
      CASE 
        WHEN v_transaction.transaction_type = 'subscription_initial' THEN cs.subscription_initial_rate
        WHEN v_transaction.transaction_type = 'subscription_renewal' THEN cs.subscription_renewal_rate
        ELSE cs.base_commission_rate
      END,
      cs.commission_type
    INTO 
      v_commission_rate,
      v_commission_type
    FROM commission_structures cs
    WHERE cs.team_member_id = p_team_member_id
      AND cs.is_active = true
      AND CURRENT_DATE BETWEEN COALESCE(cs.effective_date, CURRENT_DATE) AND COALESCE(cs.expiry_date, CURRENT_DATE)
    LIMIT 1;
  END IF;
  
  -- Default to team member's base rate if no structure found
  IF v_commission_rate IS NULL THEN
    SELECT commission_rate, commission_type
    INTO v_commission_rate, v_commission_type
    FROM team_members
    WHERE id = p_team_member_id;
  END IF;
  
  -- Calculate base amount based on commission type
  CASE v_commission_type
    WHEN 'gross' THEN
      v_base_amount := v_transaction.amount;
    WHEN 'profit' THEN
      -- Calculate profit (revenue - expenses from receipts)
      SELECT 
        v_transaction.amount - COALESCE(SUM(receipts.amount), 0)
      INTO v_base_amount
      FROM opportunity_receipts receipts
      WHERE receipts.opportunity_id = v_transaction.opportunity_id
      AND receipts.is_reimbursable = true;
    ELSE
      v_base_amount := v_transaction.amount;
  END CASE;
  
  -- Calculate commission
  IF v_commission_type = 'flat' THEN
    v_commission_amount := v_commission_rate;
  ELSE
    v_commission_amount := v_base_amount * (v_commission_rate / 100);
  END IF;
  
  RETURN QUERY SELECT 
    v_base_amount, 
    v_commission_amount, 
    v_commission_rate,
    v_commission_type,
    v_applied_rule_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Get next workflow node function
CREATE OR REPLACE FUNCTION get_next_workflow_node(
  p_workflow_id UUID,
  p_current_node_id VARCHAR,
  p_condition_data JSONB DEFAULT '{}'
)
RETURNS TABLE (
  next_node_id VARCHAR,
  connection_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wc.target_node_id,
    wc.connection_type
  FROM workflow_connections wc
  WHERE wc.workflow_id = p_workflow_id
    AND wc.source_node_id = p_current_node_id
    AND (
      wc.connection_type = 'standard' OR
      (wc.connection_type = 'conditional' AND 
       evaluate_condition(wc.condition, p_condition_data))
    )
  ORDER BY 
    CASE wc.connection_type 
      WHEN 'conditional' THEN 1 
      ELSE 2 
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Simple condition evaluator (can be expanded)
CREATE OR REPLACE FUNCTION evaluate_condition(
  p_condition JSONB,
  p_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_field TEXT;
  v_operator TEXT;
  v_value JSONB;
  v_data_value JSONB;
BEGIN
  -- Simple condition evaluation
  -- Format: {"field": "age", "operator": ">=", "value": 18}
  
  v_field := p_condition->>'field';
  v_operator := p_condition->>'operator';
  v_value := p_condition->'value';
  
  IF v_field IS NULL OR v_operator IS NULL OR v_value IS NULL THEN
    RETURN TRUE; -- No valid condition, default to true
  END IF;
  
  v_data_value := p_data->v_field;
  
  CASE v_operator
    WHEN '=' THEN RETURN v_data_value = v_value;
    WHEN '!=' THEN RETURN v_data_value != v_value;
    WHEN '>' THEN RETURN v_data_value > v_value;
    WHEN '>=' THEN RETURN v_data_value >= v_value;
    WHEN '<' THEN RETURN v_data_value < v_value;
    WHEN '<=' THEN RETURN v_data_value <= v_value;
    WHEN 'contains' THEN RETURN v_data_value::text ILIKE '%' || v_value::text || '%';
    ELSE RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 10. Organization usage update function
CREATE OR REPLACE FUNCTION update_organization_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER;
BEGIN
  -- Get organization ID based on table
  CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN v_org_id := NEW.organization_id;
    WHEN 'workflows' THEN v_org_id := NEW.organization_id;
    WHEN 'bots' THEN v_org_id := NEW.organization_id;
    WHEN 'contacts' THEN v_org_id := NEW.organization_id;
    ELSE RETURN NEW;
  END CASE;
  
  -- Update counts based on operation and table
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    CASE TG_TABLE_NAME
      WHEN 'organization_members' THEN
        SELECT COUNT(*) INTO v_count FROM organization_members 
        WHERE organization_id = v_org_id AND status = 'active';
        UPDATE organizations SET current_users = v_count WHERE id = v_org_id;
        
      WHEN 'workflows' THEN
        SELECT COUNT(*) INTO v_count FROM workflows 
        WHERE organization_id = v_org_id AND is_active = true;
        UPDATE organizations SET current_workflows = v_count WHERE id = v_org_id;
        
      WHEN 'bots' THEN
        SELECT COUNT(*) INTO v_count FROM bots 
        WHERE organization_id = v_org_id AND is_active = true;
        UPDATE organizations SET current_bots = v_count WHERE id = v_org_id;
        
      WHEN 'contacts' THEN
        SELECT COUNT(*) INTO v_count FROM contacts 
        WHERE organization_id = v_org_id;
        UPDATE organizations SET current_contacts = v_count WHERE id = v_org_id;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create usage tracking triggers
CREATE TRIGGER update_org_users_count AFTER INSERT OR UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_workflows_count AFTER INSERT OR UPDATE OR DELETE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_bots_count AFTER INSERT OR UPDATE OR DELETE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_contacts_count AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

-- Grant permissions on views
GRANT SELECT ON user_organization_view TO authenticated;
GRANT SELECT ON commission_dashboard TO authenticated;
GRANT SELECT ON active_integrations_view TO authenticated;
GRANT SELECT ON receipt_processing_summary TO authenticated;
GRANT SELECT ON team_member_commission_summary TO authenticated;
GRANT SELECT ON bot_conversation_metrics TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION calculate_commission_amount TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_workflow_node TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_condition TO authenticated;
GRANT EXECUTE ON FUNCTION update_organization_usage TO authenticated;


-- ========================================
-- Migration: 010_supplemental_tables.sql
-- ========================================
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


-- ========================================
-- Migration: 011_supplemental_rls_policies.sql
-- ========================================
-- 011_supplemental_rls_policies.sql
-- RLS policies for supplemental tables

-- USER PAYMENT STRUCTURES POLICIES
CREATE POLICY "Org members can view payment structures" ON user_payment_structures
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage payment structures" ON user_payment_structures
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- USER PAYMENT ASSIGNMENTS POLICIES
CREATE POLICY "Org members can view payment assignments" ON user_payment_assignments
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage payment assignments" ON user_payment_assignments
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- OPPORTUNITY CACHE POLICIES
CREATE POLICY "Org members can view opportunity cache" ON opportunity_cache
  FOR SELECT USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'opportunities', 'read')
  );

CREATE POLICY "System can manage opportunity cache" ON opportunity_cache
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'opportunities', 'update')
  );

-- INCOMING MESSAGES POLICIES
CREATE POLICY "Org members can view incoming messages" ON incoming_messages
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "System can manage incoming messages" ON incoming_messages
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'messages', 'update')
  );

-- CHATBOT SETTINGS POLICIES
CREATE POLICY "Org members can view chatbot settings" ON chatbot_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = chatbot_settings.bot_id
      AND is_org_member(bots.organization_id)
    )
  );

CREATE POLICY "Bot managers can update chatbot settings" ON chatbot_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = chatbot_settings.bot_id
      AND is_org_member(bots.organization_id)
      AND can_access_resource(bots.organization_id, 'bots', 'update')
    )
  );

-- WORKFLOW CHECKPOINTS POLICIES (Legacy)
CREATE POLICY "Org members can view workflow checkpoints" ON workflow_checkpoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chatbot_workflows
      WHERE chatbot_workflows.id = workflow_checkpoints.workflow_id
      AND is_org_member(chatbot_workflows.organization_id)
    )
  );

CREATE POLICY "Workflow managers can update checkpoints" ON workflow_checkpoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chatbot_workflows
      WHERE chatbot_workflows.id = workflow_checkpoints.workflow_id
      AND is_org_member(chatbot_workflows.organization_id)
      AND can_access_resource(chatbot_workflows.organization_id, 'workflows', 'update')
    )
  );

-- WORKFLOW BRANCHES POLICIES
CREATE POLICY "Org members can view workflow branches" ON workflow_branches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_checkpoints wc
      JOIN chatbot_workflows cw ON wc.workflow_id = cw.id
      WHERE wc.id = workflow_branches.checkpoint_id
      AND is_org_member(cw.organization_id)
    )
  );

CREATE POLICY "Workflow managers can manage branches" ON workflow_branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflow_checkpoints wc
      JOIN chatbot_workflows cw ON wc.workflow_id = cw.id
      WHERE wc.id = workflow_branches.checkpoint_id
      AND is_org_member(cw.organization_id)
      AND can_access_resource(cw.organization_id, 'workflows', 'update')
    )
  );

-- WORKFLOW ACTIONS POLICIES
CREATE POLICY "Org members can view workflow actions" ON workflow_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_checkpoints wc
      JOIN chatbot_workflows cw ON wc.workflow_id = cw.id
      WHERE wc.id = workflow_actions.checkpoint_id
      AND is_org_member(cw.organization_id)
    )
  );

CREATE POLICY "Workflow managers can manage actions" ON workflow_actions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflow_checkpoints wc
      JOIN chatbot_workflows cw ON wc.workflow_id = cw.id
      WHERE wc.id = workflow_actions.checkpoint_id
      AND is_org_member(cw.organization_id)
      AND can_access_resource(cw.organization_id, 'workflows', 'update')
    )
  );

-- USER COMMISSION STRUCTURES POLICIES
CREATE POLICY "Org members can view user commission structures" ON user_commission_structures
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage user commission structures" ON user_commission_structures
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- OPPORTUNITY COMMISSION OVERRIDES POLICIES
CREATE POLICY "View commission overrides" ON opportunity_commission_overrides
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      team_member_id IN (
        SELECT id FROM team_members 
        WHERE organization_id = opportunity_commission_overrides.organization_id
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage commission overrides" ON opportunity_commission_overrides
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );


-- ========================================
-- Migration: 012_auto_create_user_on_signup.sql
-- ========================================
-- Create a function that automatically creates user records and organization when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_full_name TEXT;
BEGIN
  -- Get full name from raw_user_meta_data or use email
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  
  -- Generate organization name and slug
  org_name := COALESCE(
    new.raw_user_meta_data->>'organization_name',
    user_full_name || '''s Organization'
  );
  
  org_slug := lower(regexp_replace(org_name, '[^a-z0-9]+', '-', 'g'));
  org_slug := regexp_replace(org_slug, '^-+|-+$', '', 'g');
  
  -- Ensure slug is unique
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END LOOP;

  -- Insert user record
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, user_full_name)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Only create organization if user doesn't have one
  IF NOT EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = new.id
  ) THEN
    -- Create organization
    INSERT INTO organizations (
      name,
      slug,
      subscription_status,
      subscription_plan,
      created_by
    )
    VALUES (
      org_name,
      org_slug,
      'trial',
      'free',
      new.id
    )
    RETURNING id INTO org_id;

    -- Add user as owner
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      custom_permissions,
      status,
      accepted_at
    )
    VALUES (
      org_id,
      new.id,
      'owner',
      '{}'::jsonb,
      'active',
      NOW()
    );

    -- Update organization user count
    UPDATE organizations 
    SET current_users = 1
    WHERE id = org_id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (in case user confirms email later)
CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT ON auth.users TO service_role;


-- ========================================
-- Migration: 013_cascade_delete_user.sql
-- ========================================
-- Create a function to handle user deletion that cleans up everything
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger AS $$
DECLARE
  org_ids UUID[];
BEGIN
  -- Get all organizations where user is the only owner
  SELECT ARRAY_AGG(DISTINCT om.organization_id) INTO org_ids
  FROM organization_members om
  WHERE om.user_id = OLD.id
  AND om.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.organization_id = om.organization_id
    AND om2.user_id != OLD.id
    AND om2.role = 'owner'
  );

  -- Delete organizations where user is the only owner
  IF org_ids IS NOT NULL THEN
    DELETE FROM organizations WHERE id = ANY(org_ids);
  END IF;

  -- Delete user record (cascades will handle the rest)
  DELETE FROM users WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users deletion
CREATE OR REPLACE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Ensure all foreign keys have proper cascade settings
-- (These should already exist but let's make sure)

-- Organization members should cascade delete when user is deleted
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey,
  ADD CONSTRAINT organization_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- Team members should nullify when user is deleted
ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey,
  ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

-- All organization-related tables should cascade when org is deleted
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
  ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_organization_id_fkey,
  ADD CONSTRAINT team_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Add cascades to all other organization-dependent tables
ALTER TABLE workflows 
  DROP CONSTRAINT IF EXISTS workflows_organization_id_fkey,
  ADD CONSTRAINT workflows_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE integrations 
  DROP CONSTRAINT IF EXISTS integrations_organization_id_fkey,
  ADD CONSTRAINT integrations_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE api_keys 
  DROP CONSTRAINT IF EXISTS api_keys_organization_id_fkey,
  ADD CONSTRAINT api_keys_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE opportunity_receipts 
  DROP CONSTRAINT IF EXISTS opportunity_receipts_organization_id_fkey,
  ADD CONSTRAINT opportunity_receipts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_organization_id_fkey,
  ADD CONSTRAINT time_entries_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_organization_id_fkey,
  ADD CONSTRAINT contacts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE contact_sync_logs 
  DROP CONSTRAINT IF EXISTS contact_sync_logs_organization_id_fkey,
  ADD CONSTRAINT contact_sync_logs_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE sales 
  DROP CONSTRAINT IF EXISTS sales_organization_id_fkey,
  ADD CONSTRAINT sales_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_organization_id_fkey,
  ADD CONSTRAINT products_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE commissions 
  DROP CONSTRAINT IF EXISTS commissions_organization_id_fkey,
  ADD CONSTRAINT commissions_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE payouts 
  DROP CONSTRAINT IF EXISTS payouts_organization_id_fkey,
  ADD CONSTRAINT payouts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE commission_rules 
  DROP CONSTRAINT IF EXISTS commission_rules_organization_id_fkey,
  ADD CONSTRAINT commission_rules_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE pipeline_stages 
  DROP CONSTRAINT IF EXISTS pipeline_stages_organization_id_fkey,
  ADD CONSTRAINT pipeline_stages_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE bot_workflows 
  DROP CONSTRAINT IF EXISTS bot_workflows_organization_id_fkey,
  ADD CONSTRAINT bot_workflows_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE bot_conversations 
  DROP CONSTRAINT IF EXISTS bot_conversations_organization_id_fkey,
  ADD CONSTRAINT bot_conversations_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE chat_sessions 
  DROP CONSTRAINT IF EXISTS chat_sessions_organization_id_fkey,
  ADD CONSTRAINT chat_sessions_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Grant necessary permissions
GRANT DELETE ON auth.users TO service_role;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO service_role;


-- ========================================
-- Migration: 013_cascade_delete_user_fixed.sql
-- ========================================
-- Create a function to handle user deletion that cleans up everything
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger AS $$
DECLARE
  org_ids UUID[];
BEGIN
  -- Get all organizations where user is the only owner
  SELECT ARRAY_AGG(DISTINCT om.organization_id) INTO org_ids
  FROM organization_members om
  WHERE om.user_id = OLD.id
  AND om.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.organization_id = om.organization_id
    AND om2.user_id != OLD.id
    AND om2.role = 'owner'
  );

  -- Delete organizations where user is the only owner (cascades will handle the rest)
  IF org_ids IS NOT NULL THEN
    DELETE FROM organizations WHERE id = ANY(org_ids);
  END IF;

  -- Delete user record (cascades will handle the rest)
  DELETE FROM users WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users deletion
CREATE OR REPLACE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Ensure all foreign keys have proper cascade settings for tables that exist

-- Organization members should cascade delete when user is deleted
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey,
  ADD CONSTRAINT organization_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- Team members should nullify when user is deleted
ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey,
  ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

-- All organization-related tables should cascade when org is deleted
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
  ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_organization_id_fkey,
  ADD CONSTRAINT team_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Core platform tables
ALTER TABLE workflows 
  DROP CONSTRAINT IF EXISTS workflows_organization_id_fkey,
  ADD CONSTRAINT workflows_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE integrations 
  DROP CONSTRAINT IF EXISTS integrations_organization_id_fkey,
  ADD CONSTRAINT integrations_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE api_keys 
  DROP CONSTRAINT IF EXISTS api_keys_organization_id_fkey,
  ADD CONSTRAINT api_keys_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- GoHighLevel tables
ALTER TABLE opportunity_receipts 
  DROP CONSTRAINT IF EXISTS opportunity_receipts_organization_id_fkey,
  ADD CONSTRAINT opportunity_receipts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE time_entries 
  DROP CONSTRAINT IF EXISTS time_entries_organization_id_fkey,
  ADD CONSTRAINT time_entries_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_organization_id_fkey,
  ADD CONSTRAINT contacts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE contact_sync_logs 
  DROP CONSTRAINT IF EXISTS contact_sync_logs_organization_id_fkey,
  ADD CONSTRAINT contact_sync_logs_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE pipeline_stages 
  DROP CONSTRAINT IF EXISTS pipeline_stages_organization_id_fkey,
  ADD CONSTRAINT pipeline_stages_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE company_credit_cards 
  DROP CONSTRAINT IF EXISTS company_credit_cards_organization_id_fkey,
  ADD CONSTRAINT company_credit_cards_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Sales and commissions tables (using actual table names)
ALTER TABLE sales_transactions 
  DROP CONSTRAINT IF EXISTS sales_transactions_organization_id_fkey,
  ADD CONSTRAINT sales_transactions_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE ghl_products 
  DROP CONSTRAINT IF EXISTS ghl_products_organization_id_fkey,
  ADD CONSTRAINT ghl_products_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE commission_calculations 
  DROP CONSTRAINT IF EXISTS commission_calculations_organization_id_fkey,
  ADD CONSTRAINT commission_calculations_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE commission_payouts 
  DROP CONSTRAINT IF EXISTS commission_payouts_organization_id_fkey,
  ADD CONSTRAINT commission_payouts_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE commission_rules 
  DROP CONSTRAINT IF EXISTS commission_rules_organization_id_fkey,
  ADD CONSTRAINT commission_rules_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Chatbot system tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bots') THEN
    ALTER TABLE bots 
      DROP CONSTRAINT IF EXISTS bots_organization_id_fkey,
      ADD CONSTRAINT bots_organization_id_fkey 
        FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) 
        ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_workflows') THEN
    ALTER TABLE bot_workflows 
      DROP CONSTRAINT IF EXISTS bot_workflows_organization_id_fkey,
      ADD CONSTRAINT bot_workflows_organization_id_fkey 
        FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) 
        ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    ALTER TABLE chat_sessions 
      DROP CONSTRAINT IF EXISTS chat_sessions_organization_id_fkey,
      ADD CONSTRAINT chat_sessions_organization_id_fkey 
        FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) 
        ON DELETE CASCADE;
  END IF;
END $$;

-- Grant necessary permissions
GRANT DELETE ON auth.users TO service_role;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO service_role;


-- ========================================
-- Migration: 013_cascade_delete_user_minimal.sql
-- ========================================
-- Create a function to handle user deletion that cleans up everything
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger AS $$
DECLARE
  org_ids UUID[];
BEGIN
  -- Get all organizations where user is the only owner
  SELECT ARRAY_AGG(DISTINCT om.organization_id) INTO org_ids
  FROM organization_members om
  WHERE om.user_id = OLD.id
  AND om.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.organization_id = om.organization_id
    AND om2.user_id != OLD.id
    AND om2.role = 'owner'
  );

  -- Delete organizations where user is the only owner (cascades will handle the rest)
  IF org_ids IS NOT NULL THEN
    DELETE FROM organizations WHERE id = ANY(org_ids);
  END IF;

  -- Delete user record (cascades will handle the rest)
  DELETE FROM users WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users deletion
CREATE OR REPLACE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- Only set up cascades for tables that definitely have organization_id column
-- Core organization relationships
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey,
  ADD CONSTRAINT organization_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey,
  ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
  ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

ALTER TABLE team_members 
  DROP CONSTRAINT IF EXISTS team_members_organization_id_fkey,
  ADD CONSTRAINT team_members_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) 
    ON DELETE CASCADE;

-- Only handle tables that we know exist and have organization_id
DO $$
DECLARE
  table_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- Check each table individually before adding constraints
  
  -- Check workflows table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'workflows'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'workflows' AND column_name = 'organization_id'
    ) INTO column_exists;
    
    IF column_exists THEN
      ALTER TABLE workflows 
        DROP CONSTRAINT IF EXISTS workflows_organization_id_fkey,
        ADD CONSTRAINT workflows_organization_id_fkey 
          FOREIGN KEY (organization_id) 
          REFERENCES organizations(id) 
          ON DELETE CASCADE;
    END IF;
  END IF;

  -- Check integrations table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'integrations'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'integrations' AND column_name = 'organization_id'
    ) INTO column_exists;
    
    IF column_exists THEN
      ALTER TABLE integrations 
        DROP CONSTRAINT IF EXISTS integrations_organization_id_fkey,
        ADD CONSTRAINT integrations_organization_id_fkey 
          FOREIGN KEY (organization_id) 
          REFERENCES organizations(id) 
          ON DELETE CASCADE;
    END IF;
  END IF;

  -- Check contacts table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'contacts'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'organization_id'
    ) INTO column_exists;
    
    IF column_exists THEN
      ALTER TABLE contacts 
        DROP CONSTRAINT IF EXISTS contacts_organization_id_fkey,
        ADD CONSTRAINT contacts_organization_id_fkey 
          FOREIGN KEY (organization_id) 
          REFERENCES organizations(id) 
          ON DELETE CASCADE;
    END IF;
  END IF;

  -- Check bots table (this one we know has organization_id)
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'bots'
  ) INTO table_exists;
  
  IF table_exists THEN
    ALTER TABLE bots 
      DROP CONSTRAINT IF EXISTS bots_organization_id_fkey,
      ADD CONSTRAINT bots_organization_id_fkey 
        FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) 
        ON DELETE CASCADE;
  END IF;

END $$;

-- Grant necessary permissions
GRANT DELETE ON auth.users TO service_role;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO service_role;


-- ========================================
-- Migration: 014_business_context.sql
-- ========================================
-- 014_business_context.sql
-- Business context system for AI bots

-- 1. Business contexts table
CREATE TABLE business_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Context',
  description TEXT,
  
  -- Core business information
  business_name TEXT NOT NULL,
  business_type TEXT, -- e.g., 'real_estate', 'dental', 'fitness', 'consulting'
  industry TEXT,
  
  -- Business details
  services_offered TEXT[], -- Array of services
  target_audience TEXT,
  unique_value_proposition TEXT,
  
  -- Communication preferences
  tone_of_voice TEXT, -- e.g., 'professional', 'friendly', 'casual', 'authoritative'
  language_style TEXT, -- e.g., 'formal', 'conversational', 'technical'
  
  -- Key information
  business_hours JSONB, -- Store hours by day
  contact_information JSONB, -- Phone, email, address, etc.
  key_policies TEXT[], -- Important policies to mention
  faqs JSONB[], -- Common Q&As
  
  -- AI behavior instructions
  response_guidelines TEXT[], -- How the bot should respond
  prohibited_topics TEXT[], -- Topics to avoid
  escalation_triggers TEXT[], -- When to hand off to human
  
  -- Additional context
  custom_instructions TEXT, -- Free-form additional instructions
  knowledge_base JSONB, -- Additional structured knowledge
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- One default per organization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, name)
);

-- 2. Bot context assignments (which bots use which contexts)
CREATE TABLE bot_context_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  context_id UUID NOT NULL REFERENCES business_contexts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0, -- For multiple contexts, higher = more important
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(bot_id, context_id)
);

-- 3. Context templates for quick setup
CREATE TABLE context_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL, -- Pre-filled context data
  use_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_business_contexts_org ON business_contexts(organization_id);
CREATE INDEX idx_business_contexts_active ON business_contexts(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_business_contexts_default ON business_contexts(organization_id, is_default) WHERE is_default = true;
CREATE INDEX idx_bot_context_assignments_bot ON bot_context_assignments(bot_id);
CREATE INDEX idx_bot_context_assignments_context ON bot_context_assignments(context_id);
CREATE INDEX idx_context_templates_type ON context_templates(business_type);

-- Create trigger for updated_at
CREATE TRIGGER update_business_contexts_updated_at BEFORE UPDATE ON business_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default context per organization
CREATE OR REPLACE FUNCTION ensure_single_default_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE business_contexts 
    SET is_default = false 
    WHERE organization_id = NEW.organization_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_context_trigger
BEFORE INSERT OR UPDATE ON business_contexts
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_context();

-- Insert some default templates
INSERT INTO context_templates (name, business_type, description, template_data) VALUES
(
  'Real Estate Agency',
  'real_estate',
  'Template for real estate agencies and brokers',
  '{
    "business_type": "real_estate",
    "tone_of_voice": "professional",
    "language_style": "conversational",
    "services_offered": ["Property buying", "Property selling", "Property management", "Real estate consultation"],
    "response_guidelines": [
      "Always be helpful and informative about property details",
      "Offer to schedule property viewings",
      "Provide market insights when relevant",
      "Emphasize local expertise"
    ],
    "escalation_triggers": [
      "Legal questions",
      "Specific pricing negotiations",
      "Contract details"
    ]
  }'::jsonb
),
(
  'Dental Practice',
  'dental',
  'Template for dental clinics and practices',
  '{
    "business_type": "dental",
    "tone_of_voice": "friendly",
    "language_style": "conversational",
    "services_offered": ["General dentistry", "Teeth cleaning", "Fillings", "Crowns", "Emergency dental care"],
    "response_guidelines": [
      "Be reassuring about dental procedures",
      "Emphasize pain-free and comfortable experience",
      "Offer appointment scheduling",
      "Provide general dental health tips"
    ],
    "escalation_triggers": [
      "Medical emergencies",
      "Specific treatment recommendations",
      "Insurance coverage details"
    ]
  }'::jsonb
),
(
  'Fitness Studio',
  'fitness',
  'Template for gyms and fitness studios',
  '{
    "business_type": "fitness",
    "tone_of_voice": "energetic",
    "language_style": "casual",
    "services_offered": ["Personal training", "Group classes", "Nutrition counseling", "Fitness assessments"],
    "response_guidelines": [
      "Be motivating and encouraging",
      "Highlight success stories",
      "Offer free trials or consultations",
      "Emphasize community and support"
    ],
    "escalation_triggers": [
      "Medical conditions",
      "Injury concerns",
      "Specific program customization"
    ]
  }'::jsonb
);

-- RLS Policies
ALTER TABLE business_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_context_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_templates ENABLE ROW LEVEL SECURITY;

-- Business contexts policies
CREATE POLICY "Users can view their organization's contexts" ON business_contexts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create contexts for their organization" ON business_contexts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can update their organization's contexts" ON business_contexts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can delete their organization's contexts" ON business_contexts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator')
    )
  );

-- Bot context assignments policies
CREATE POLICY "Users can view their organization's assignments" ON bot_context_assignments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's assignments" ON bot_context_assignments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

-- Templates are public
CREATE POLICY "Anyone can view public templates" ON context_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create templates" ON context_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ========================================
-- Migration: 014_unified_commission_system.sql
-- ========================================
-- 014_unified_commission_system.sql
-- Comprehensive commission tracking system for opportunities and platform events

-- 1. Commission Events - Track all events that can generate commissions
CREATE TABLE commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event source and type
  event_source VARCHAR(50) NOT NULL CHECK (event_source IN (
    'opportunity', 'payment', 'estimate', 'invoice', 'subscription', 'manual'
  )),
  event_type VARCHAR(100) NOT NULL, -- e.g., 'opportunity_won', 'payment_collected', 'estimate_sent', 'invoice_paid'
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- References to source records
  opportunity_id VARCHAR, -- GHL opportunity ID
  payment_id VARCHAR, -- GHL payment ID
  invoice_id VARCHAR, -- GHL invoice ID
  estimate_id VARCHAR, -- GHL estimate ID
  contact_id VARCHAR NOT NULL, -- GHL contact ID
  
  -- Financial details
  event_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Event metadata
  event_data JSONB DEFAULT '{}', -- Store additional event-specific data
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Commission Assignments - Define who gets commissions for what
CREATE TABLE commission_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Assignment scope
  assignment_type VARCHAR(50) NOT NULL CHECK (assignment_type IN (
    'opportunity', 'team_member', 'role', 'global'
  )),
  
  -- Who gets the commission
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR, -- For backwards compatibility
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- What they get commission on
  opportunity_id VARCHAR, -- Specific opportunity (if assignment_type = 'opportunity')
  role_name VARCHAR, -- Role-based assignment (if assignment_type = 'role')
  
  -- Commission structure
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN (
    'percentage_gross', 'percentage_profit', 'fixed_amount', 'tiered', 'hybrid'
  )),
  base_rate DECIMAL(5,2) CHECK (base_rate >= 0 AND base_rate <= 100),
  fixed_amount DECIMAL(10,2),
  
  -- Event-specific rates (can override base_rate)
  payment_collected_rate DECIMAL(5,2),
  estimate_sent_rate DECIMAL(5,2),
  invoice_paid_rate DECIMAL(5,2),
  opportunity_won_rate DECIMAL(5,2),
  subscription_initial_rate DECIMAL(5,2),
  subscription_renewal_rate DECIMAL(5,2),
  
  -- Tiered commission structure
  tier_config JSONB DEFAULT '[]', -- Array of {min_amount, max_amount, rate}
  
  -- Pipeline stage requirements (optional)
  required_pipeline_id VARCHAR, -- Which pipeline this applies to
  required_stage_id VARCHAR, -- Stage that must be reached for commission eligibility
  required_stage_name VARCHAR, -- Human-readable stage name for reference
  stage_requirement_type VARCHAR(50) DEFAULT 'reached' CHECK (
    stage_requirement_type IN ('reached', 'completed', 'won', NULL)
  ),
  
  -- Assignment metadata
  priority INTEGER DEFAULT 0, -- Higher priority assignments override lower ones
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT valid_assignment CHECK (
    (assignment_type = 'opportunity' AND opportunity_id IS NOT NULL) OR
    (assignment_type = 'team_member' AND team_member_id IS NOT NULL) OR
    (assignment_type = 'role' AND role_name IS NOT NULL) OR
    (assignment_type = 'global')
  )
);

-- 3. Commission Records - Actual calculated commissions
CREATE TABLE commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Link to event and assignment
  event_id UUID NOT NULL REFERENCES commission_events(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES commission_assignments(id),
  
  -- Who earned the commission
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Commission calculation
  base_amount DECIMAL(12,2) NOT NULL, -- Amount commission is calculated on
  commission_rate DECIMAL(5,2), -- Rate applied (if percentage)
  commission_amount DECIMAL(12,2) NOT NULL, -- Calculated commission
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Calculation details
  calculation_method VARCHAR(100), -- How it was calculated
  calculation_details JSONB DEFAULT '{}', -- Breakdown of calculation
  
  -- Profit calculations (if applicable)
  revenue_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  profit_amount DECIMAL(12,2),
  
  -- Status and approval
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'paid', 'cancelled', 'disputed', 'on_hold'
  )),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Payment tracking
  payout_id UUID, -- Link to commission_payouts
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Payout scheduling
  is_due_for_payout BOOLEAN DEFAULT false,
  payout_deadline DATE, -- Optional deadline for when commission should be paid
  payout_scheduled_date DATE, -- When the payout is scheduled to happen
  
  -- Pipeline stage tracking
  pipeline_stage_met BOOLEAN DEFAULT false, -- Has the required pipeline stage been reached?
  pipeline_stage_met_at TIMESTAMP WITH TIME ZONE, -- When the stage requirement was met
  current_pipeline_stage VARCHAR, -- Current stage of the opportunity
  
  -- Dispute handling
  is_disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Commission Rules - Global rules for commission calculation
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule definition
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
    'event_type', 'amount_range', 'product', 'pipeline', 'custom'
  )),
  
  -- Rule conditions
  event_types JSONB DEFAULT '[]', -- Which event types this applies to
  min_amount DECIMAL(12,2),
  max_amount DECIMAL(12,2),
  product_ids JSONB DEFAULT '[]',
  pipeline_ids JSONB DEFAULT '[]',
  custom_conditions JSONB DEFAULT '{}',
  
  -- Commission configuration
  commission_type VARCHAR(50) NOT NULL,
  commission_rate DECIMAL(5,2),
  fixed_amount DECIMAL(10,2),
  
  -- Rule application
  applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN (
    'all', 'specific_members', 'specific_roles'
  )),
  team_member_ids JSONB DEFAULT '[]',
  role_names JSONB DEFAULT '[]',
  
  -- Priority and status
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, rule_name)
);

-- 5. Commission Splits - For splitting commissions between multiple people
CREATE TABLE commission_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID NOT NULL REFERENCES commission_records(id) ON DELETE CASCADE,
  
  -- Split recipient
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Split details
  split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_amount DECIMAL(12,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Commission Adjustments - Manual adjustments to commissions
CREATE TABLE commission_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  
  -- Adjustment details
  adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
    'bonus', 'deduction', 'correction', 'clawback'
  )),
  adjustment_amount DECIMAL(12,2) NOT NULL, -- Positive for additions, negative for deductions
  adjustment_reason TEXT NOT NULL,
  
  -- Approval
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_commission_events_org ON commission_events(organization_id);
CREATE INDEX idx_commission_events_opportunity ON commission_events(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_commission_events_contact ON commission_events(contact_id);
CREATE INDEX idx_commission_events_date ON commission_events(event_date);
CREATE INDEX idx_commission_events_source_type ON commission_events(event_source, event_type);

CREATE INDEX idx_commission_assignments_org ON commission_assignments(organization_id);
CREATE INDEX idx_commission_assignments_opportunity ON commission_assignments(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_commission_assignments_team_member ON commission_assignments(team_member_id);
CREATE INDEX idx_commission_assignments_active ON commission_assignments(is_active, effective_date);

CREATE INDEX idx_commission_records_org ON commission_records(organization_id);
CREATE INDEX idx_commission_records_event ON commission_records(event_id);
CREATE INDEX idx_commission_records_assignment ON commission_records(assignment_id);
CREATE INDEX idx_commission_records_team_member ON commission_records(team_member_id);
CREATE INDEX idx_commission_records_status ON commission_records(status);
CREATE INDEX idx_commission_records_payout ON commission_records(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX idx_commission_records_due_payout ON commission_records(is_due_for_payout, payout_deadline) WHERE is_due_for_payout = true;
CREATE INDEX idx_commission_records_payout_deadline ON commission_records(payout_deadline) WHERE payout_deadline IS NOT NULL;

CREATE INDEX idx_commission_rules_org ON commission_rules(organization_id);
CREATE INDEX idx_commission_rules_active ON commission_rules(is_active, priority);

CREATE INDEX idx_commission_splits_record ON commission_splits(commission_record_id);
CREATE INDEX idx_commission_adjustments_org ON commission_adjustments(organization_id);
CREATE INDEX idx_commission_adjustments_record ON commission_adjustments(commission_record_id);

-- Create triggers
CREATE TRIGGER update_commission_events_updated_at 
  BEFORE UPDATE ON commission_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_assignments_updated_at 
  BEFORE UPDATE ON commission_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_records_updated_at 
  BEFORE UPDATE ON commission_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_rules_updated_at 
  BEFORE UPDATE ON commission_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commission(
  p_event_id UUID,
  p_assignment_id UUID
) RETURNS TABLE (
  commission_amount DECIMAL(12,2),
  calculation_method VARCHAR(100),
  calculation_details JSONB
) AS $$
DECLARE
  v_event commission_events%ROWTYPE;
  v_assignment commission_assignments%ROWTYPE;
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(12,2);
  v_calculation_method VARCHAR(100);
  v_calculation_details JSONB;
BEGIN
  -- Get event and assignment details
  SELECT * INTO v_event FROM commission_events WHERE id = p_event_id;
  SELECT * INTO v_assignment FROM commission_assignments WHERE id = p_assignment_id;
  
  -- Determine commission rate based on event type
  v_commission_rate := v_assignment.base_rate;
  
  CASE v_event.event_type
    WHEN 'payment_collected' THEN
      v_commission_rate := COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate);
    WHEN 'estimate_sent' THEN
      v_commission_rate := COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate);
    WHEN 'invoice_paid' THEN
      v_commission_rate := COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate);
    WHEN 'opportunity_won' THEN
      v_commission_rate := COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate);
    ELSE
      v_commission_rate := v_assignment.base_rate;
  END CASE;
  
  -- Calculate commission based on type
  IF v_assignment.commission_type = 'percentage_gross' THEN
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'percentage_gross';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  ELSIF v_assignment.commission_type = 'fixed_amount' THEN
    v_commission_amount := v_assignment.fixed_amount;
    v_calculation_method := 'fixed_amount';
    v_calculation_details := jsonb_build_object(
      'fixed_amount', v_assignment.fixed_amount
    );
  ELSE
    -- Default to percentage gross
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'default_percentage';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  END IF;
  
  RETURN QUERY SELECT v_commission_amount, v_calculation_method, v_calculation_details;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create commission records when events occur
CREATE OR REPLACE FUNCTION process_commission_event()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_calc RECORD;
BEGIN
  -- Find applicable commission assignments
  FOR v_assignment IN
    SELECT * FROM commission_assignments
    WHERE organization_id = NEW.organization_id
      AND is_active = true
      AND effective_date <= CURRENT_DATE
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      AND (
        (assignment_type = 'opportunity' AND opportunity_id = NEW.opportunity_id) OR
        (assignment_type = 'global') OR
        (assignment_type = 'team_member' AND team_member_id IN (
          SELECT team_member_id FROM sales_transactions 
          WHERE opportunity_id = NEW.opportunity_id
          LIMIT 1
        ))
      )
    ORDER BY priority DESC
  LOOP
    -- Calculate commission
    SELECT * INTO v_calc FROM calculate_commission(NEW.id, v_assignment.id);
    
    -- Create commission record
    INSERT INTO commission_records (
      organization_id,
      event_id,
      assignment_id,
      team_member_id,
      ghl_user_id,
      user_name,
      user_email,
      base_amount,
      commission_rate,
      commission_amount,
      calculation_method,
      calculation_details,
      status
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      v_assignment.id,
      v_assignment.team_member_id,
      v_assignment.ghl_user_id,
      v_assignment.user_name,
      v_assignment.user_email,
      NEW.event_amount,
      CASE 
        WHEN v_assignment.commission_type LIKE 'percentage%' THEN
          CASE NEW.event_type
            WHEN 'payment_collected' THEN COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate)
            WHEN 'estimate_sent' THEN COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate)
            WHEN 'invoice_paid' THEN COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate)
            WHEN 'opportunity_won' THEN COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate)
            ELSE v_assignment.base_rate
          END
        ELSE NULL
      END,
      v_calc.commission_amount,
      v_calc.calculation_method,
      v_calc.calculation_details,
      'pending'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process commissions when events are created
CREATE TRIGGER process_commission_on_event 
  AFTER INSERT ON commission_events
  FOR EACH ROW EXECUTE FUNCTION process_commission_event();

-- Function to update commission payout status based on approval and stage requirements
CREATE OR REPLACE FUNCTION update_commission_payout_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_stage_required BOOLEAN := false;
BEGIN
  -- Get the assignment details to check for stage requirements
  SELECT * INTO v_assignment 
  FROM commission_assignments 
  WHERE id = NEW.assignment_id;
  
  -- Check if this assignment has pipeline stage requirements
  IF v_assignment.required_stage_id IS NOT NULL THEN
    v_stage_required := true;
  END IF;
  
  -- When a commission is approved, check if it can be marked as due for payout
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- If no stage requirement OR stage requirement is met, mark as due for payout
    IF NOT v_stage_required OR NEW.pipeline_stage_met = true THEN
      NEW.is_due_for_payout := true;
      -- Set default payout deadline to end of next month if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When pipeline stage requirement is met, check if commission should be due for payout
  IF NEW.pipeline_stage_met = true AND OLD.pipeline_stage_met = false THEN
    -- If commission is already approved, mark as due for payout
    IF NEW.status = 'approved' THEN
      NEW.is_due_for_payout := true;
      NEW.pipeline_stage_met_at := NOW();
      -- Set default payout deadline if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When a commission is paid, mark it as no longer due
  IF NEW.status = 'paid' THEN
    NEW.is_due_for_payout := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update payout status
CREATE TRIGGER update_payout_status_on_commission_change
  BEFORE UPDATE ON commission_records
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.pipeline_stage_met IS DISTINCT FROM NEW.pipeline_stage_met)
  EXECUTE FUNCTION update_commission_payout_status();

-- Function to update commission records when opportunity stage changes
CREATE OR REPLACE FUNCTION update_commissions_on_stage_change(
  p_organization_id UUID,
  p_opportunity_id VARCHAR,
  p_pipeline_id VARCHAR,
  p_stage_id VARCHAR,
  p_stage_name VARCHAR
) RETURNS void AS $$
DECLARE
  v_commission RECORD;
  v_assignment commission_assignments%ROWTYPE;
BEGIN
  -- Find all commission records for this opportunity that are waiting for a stage
  FOR v_commission IN 
    SELECT cr.*, ca.required_stage_id, ca.required_pipeline_id, ca.stage_requirement_type
    FROM commission_records cr
    JOIN commission_assignments ca ON ca.id = cr.assignment_id
    JOIN commission_events ce ON ce.id = cr.event_id
    WHERE ce.organization_id = p_organization_id
      AND ce.opportunity_id = p_opportunity_id
      AND cr.pipeline_stage_met = false
      AND ca.required_stage_id IS NOT NULL
  LOOP
    -- Check if the stage requirement is met
    IF (v_commission.required_pipeline_id IS NULL OR v_commission.required_pipeline_id = p_pipeline_id)
       AND v_commission.required_stage_id = p_stage_id THEN
      -- Update the commission record
      UPDATE commission_records
      SET 
        pipeline_stage_met = true,
        pipeline_stage_met_at = NOW(),
        current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    ELSE
      -- Just update the current stage
      UPDATE commission_records
      SET current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create an index for finding commissions by opportunity
CREATE INDEX idx_commission_events_opportunity_org ON commission_events(organization_id, opportunity_id);

-- Create view for opportunity commissions (for backwards compatibility)
CREATE OR REPLACE VIEW opportunity_commissions AS
SELECT 
  ca.id,
  ca.organization_id,
  ca.opportunity_id,
  ca.team_member_id,
  ca.ghl_user_id,
  ca.user_name,
  ca.user_email,
  CASE 
    WHEN ca.commission_type LIKE 'percentage%' THEN ca.commission_type
    ELSE 'custom'
  END as commission_type,
  ca.base_rate as commission_percentage,
  ca.notes,
  ca.created_at,
  ca.updated_at
FROM commission_assignments ca
WHERE ca.assignment_type = 'opportunity'
  AND ca.is_active = true;

-- Create view for commissions pending stage requirements
CREATE OR REPLACE VIEW commissions_pending_stage AS
SELECT 
  cr.id,
  cr.organization_id,
  ce.opportunity_id,
  cr.team_member_id,
  cr.user_name,
  cr.commission_amount,
  cr.status,
  cr.current_pipeline_stage,
  ca.required_pipeline_id,
  ca.required_stage_id,
  ca.required_stage_name,
  ca.stage_requirement_type,
  cr.pipeline_stage_met,
  cr.is_due_for_payout,
  cr.payout_deadline
FROM commission_records cr
JOIN commission_assignments ca ON ca.id = cr.assignment_id
JOIN commission_events ce ON ce.id = cr.event_id
WHERE ca.required_stage_id IS NOT NULL
  AND cr.pipeline_stage_met = false
  AND cr.status = 'approved';

-- Create view for commissions ready for payout
CREATE OR REPLACE VIEW commissions_ready_for_payout AS
SELECT 
  cr.id,
  cr.organization_id,
  cr.team_member_id,
  cr.user_name,
  cr.user_email,
  cr.commission_amount,
  cr.currency,
  ce.opportunity_id,
  ce.event_type,
  ce.event_date,
  cr.payout_deadline,
  cr.pipeline_stage_met,
  cr.pipeline_stage_met_at,
  cr.approved_at
FROM commission_records cr
JOIN commission_events ce ON ce.id = cr.event_id
WHERE cr.is_due_for_payout = true
  AND cr.status = 'approved'
  AND cr.payout_id IS NULL
ORDER BY cr.payout_deadline, cr.approved_at;

-- Create RLS policies
CREATE POLICY "Organization members can view commission data" ON commission_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_events.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can manage commission assignments" ON commission_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_assignments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view commission records" ON commission_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_records.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage commission rules" ON commission_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );

CREATE POLICY "Organization members can view commission splits" ON commission_splits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM commission_records cr
      JOIN organization_members om ON om.organization_id = cr.organization_id
      WHERE cr.id = commission_splits.commission_record_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage commission adjustments" ON commission_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_adjustments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );


-- ========================================
-- Migration: 015_bot_specific_context.sql
-- ========================================
-- 015_bot_specific_context.sql
-- Refactor business contexts to be bot-specific

-- Drop the old tables and constraints
DROP TABLE IF EXISTS bot_context_assignments CASCADE;
DROP TABLE IF EXISTS business_contexts CASCADE;
DROP TABLE IF EXISTS context_templates CASCADE;

-- 1. Bot contexts table (linked to specific bots)
CREATE TABLE bot_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Core business information
  business_name TEXT NOT NULL,
  business_type TEXT, -- e.g., 'real_estate', 'dental', 'fitness', 'consulting'
  industry TEXT,
  
  -- Business details
  services_offered TEXT[], -- Array of services
  target_audience TEXT,
  unique_value_proposition TEXT,
  
  -- Communication preferences
  tone_of_voice TEXT DEFAULT 'professional', -- e.g., 'professional', 'friendly', 'casual', 'authoritative'
  language_style TEXT DEFAULT 'conversational', -- e.g., 'formal', 'conversational', 'technical'
  
  -- Key information
  business_hours JSONB, -- Store hours by day
  contact_information JSONB, -- Phone, email, address, etc.
  key_policies TEXT[], -- Important policies to mention
  faqs JSONB[], -- Common Q&As
  
  -- AI behavior instructions
  response_guidelines TEXT[], -- How the bot should respond
  prohibited_topics TEXT[], -- Topics to avoid
  escalation_triggers TEXT[], -- When to hand off to human
  
  -- Additional context
  custom_instructions TEXT, -- Free-form additional instructions
  knowledge_base JSONB, -- Additional structured knowledge
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(bot_id) -- One context per bot
);

-- 2. Context templates for quick setup
CREATE TABLE bot_context_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL, -- Pre-filled context data
  use_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_bot_contexts_bot ON bot_contexts(bot_id);
CREATE INDEX idx_bot_contexts_org ON bot_contexts(organization_id);
CREATE INDEX idx_bot_context_templates_type ON bot_context_templates(business_type);

-- Create trigger for updated_at
CREATE TRIGGER update_bot_contexts_updated_at BEFORE UPDATE ON bot_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default templates
INSERT INTO bot_context_templates (name, business_type, description, template_data) VALUES
(
  'Real Estate Agency',
  'real_estate',
  'Template for real estate agencies and brokers',
  '{
    "business_type": "real_estate",
    "tone_of_voice": "professional",
    "language_style": "conversational",
    "services_offered": ["Property buying", "Property selling", "Property management", "Real estate consultation"],
    "response_guidelines": [
      "Always be helpful and informative about property details",
      "Offer to schedule property viewings",
      "Provide market insights when relevant",
      "Emphasize local expertise"
    ],
    "escalation_triggers": [
      "Legal questions",
      "Specific pricing negotiations",
      "Contract details"
    ]
  }'::jsonb
),
(
  'Dental Practice',
  'dental',
  'Template for dental clinics and practices',
  '{
    "business_type": "dental",
    "tone_of_voice": "friendly",
    "language_style": "conversational",
    "services_offered": ["General dentistry", "Teeth cleaning", "Fillings", "Crowns", "Emergency dental care"],
    "response_guidelines": [
      "Be reassuring about dental procedures",
      "Emphasize pain-free and comfortable experience",
      "Offer appointment scheduling",
      "Provide general dental health tips"
    ],
    "escalation_triggers": [
      "Medical emergencies",
      "Specific treatment recommendations",
      "Insurance coverage details"
    ]
  }'::jsonb
),
(
  'Fitness Studio',
  'fitness',
  'Template for gyms and fitness studios',
  '{
    "business_type": "fitness",
    "tone_of_voice": "energetic",
    "language_style": "casual",
    "services_offered": ["Personal training", "Group classes", "Nutrition counseling", "Fitness assessments"],
    "response_guidelines": [
      "Be motivating and encouraging",
      "Highlight success stories",
      "Offer free trials or consultations",
      "Emphasize community and support"
    ],
    "escalation_triggers": [
      "Medical conditions",
      "Injury concerns",
      "Specific program customization"
    ]
  }'::jsonb
),
(
  'E-commerce Store',
  'ecommerce',
  'Template for online retail businesses',
  '{
    "business_type": "ecommerce",
    "tone_of_voice": "friendly",
    "language_style": "conversational",
    "services_offered": ["Online shopping", "Product recommendations", "Order tracking", "Customer support"],
    "response_guidelines": [
      "Help customers find the right products",
      "Provide detailed product information",
      "Assist with order issues",
      "Offer personalized recommendations"
    ],
    "escalation_triggers": [
      "Payment issues",
      "Refund requests",
      "Complex technical problems"
    ]
  }'::jsonb
),
(
  'SaaS Company',
  'saas',
  'Template for software as a service companies',
  '{
    "business_type": "saas",
    "tone_of_voice": "professional",
    "language_style": "technical",
    "services_offered": ["Software solutions", "Technical support", "Implementation assistance", "Training"],
    "response_guidelines": [
      "Explain features clearly",
      "Provide helpful documentation links",
      "Offer demos and trials",
      "Address technical questions accurately"
    ],
    "escalation_triggers": [
      "Billing issues",
      "Advanced technical problems",
      "Enterprise requirements"
    ]
  }'::jsonb
);

-- RLS Policies
ALTER TABLE bot_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_context_templates ENABLE ROW LEVEL SECURITY;

-- Bot contexts policies
CREATE POLICY "Users can view their organization's bot contexts" ON bot_contexts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bot contexts for their organization" ON bot_contexts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can update their organization's bot contexts" ON bot_contexts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can delete their organization's bot contexts" ON bot_contexts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator')
    )
  );

-- Templates are public
CREATE POLICY "Anyone can view public templates" ON bot_context_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create templates" ON bot_context_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ========================================
-- Migration: 015_unified_commission_system_update.sql
-- ========================================
-- 015_unified_commission_system_update.sql
-- Updates existing commission system to support unified tracking

-- 1. Commission Events - Track all events that can generate commissions
CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event source and type
  event_source VARCHAR(50) NOT NULL CHECK (event_source IN (
    'opportunity', 'payment', 'estimate', 'invoice', 'subscription', 'manual'
  )),
  event_type VARCHAR(100) NOT NULL, -- e.g., 'opportunity_won', 'payment_collected', 'estimate_sent', 'invoice_paid'
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- References to source records
  opportunity_id VARCHAR, -- GHL opportunity ID
  payment_id VARCHAR, -- GHL payment ID
  invoice_id VARCHAR, -- GHL invoice ID
  estimate_id VARCHAR, -- GHL estimate ID
  contact_id VARCHAR NOT NULL, -- GHL contact ID
  
  -- Financial details
  event_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Event metadata
  event_data JSONB DEFAULT '{}', -- Store additional event-specific data
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Commission Assignments - Define who gets commissions for what
CREATE TABLE IF NOT EXISTS commission_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Assignment scope
  assignment_type VARCHAR(50) NOT NULL CHECK (assignment_type IN (
    'opportunity', 'team_member', 'role', 'global'
  )),
  
  -- Who gets the commission
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR, -- For backwards compatibility
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- What they get commission on
  opportunity_id VARCHAR, -- Specific opportunity (if assignment_type = 'opportunity')
  role_name VARCHAR, -- Role-based assignment (if assignment_type = 'role')
  
  -- Commission structure
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN (
    'percentage_gross', 'percentage_profit', 'fixed_amount', 'tiered', 'hybrid'
  )),
  base_rate DECIMAL(5,2) CHECK (base_rate >= 0 AND base_rate <= 100),
  fixed_amount DECIMAL(10,2),
  
  -- Event-specific rates (can override base_rate)
  payment_collected_rate DECIMAL(5,2),
  estimate_sent_rate DECIMAL(5,2),
  invoice_paid_rate DECIMAL(5,2),
  opportunity_won_rate DECIMAL(5,2),
  subscription_initial_rate DECIMAL(5,2),
  subscription_renewal_rate DECIMAL(5,2),
  
  -- Tiered commission structure
  tier_config JSONB DEFAULT '[]', -- Array of {min_amount, max_amount, rate}
  
  -- Pipeline stage requirements (optional)
  required_pipeline_id VARCHAR, -- Which pipeline this applies to
  required_stage_id VARCHAR, -- Stage that must be reached for commission eligibility
  required_stage_name VARCHAR, -- Human-readable stage name for reference
  stage_requirement_type VARCHAR(50) DEFAULT 'reached' CHECK (
    stage_requirement_type IN ('reached', 'completed', 'won', NULL)
  ),
  
  -- Assignment metadata
  priority INTEGER DEFAULT 0, -- Higher priority assignments override lower ones
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT valid_assignment CHECK (
    (assignment_type = 'opportunity' AND opportunity_id IS NOT NULL) OR
    (assignment_type = 'team_member' AND team_member_id IS NOT NULL) OR
    (assignment_type = 'role' AND role_name IS NOT NULL) OR
    (assignment_type = 'global')
  )
);

-- 3. Commission Records - Actual calculated commissions (renamed from commission_calculations)
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Link to event and assignment
  event_id UUID REFERENCES commission_events(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES commission_assignments(id),
  
  -- Who earned the commission
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Commission calculation
  base_amount DECIMAL(12,2) NOT NULL, -- Amount commission is calculated on
  commission_rate DECIMAL(5,2), -- Rate applied (if percentage)
  commission_amount DECIMAL(12,2) NOT NULL, -- Calculated commission
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Calculation details
  calculation_method VARCHAR(100), -- How it was calculated
  calculation_details JSONB DEFAULT '{}', -- Breakdown of calculation
  
  -- Profit calculations (if applicable)
  revenue_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  profit_amount DECIMAL(12,2),
  
  -- Status and approval
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'paid', 'cancelled', 'disputed', 'on_hold'
  )),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Payment tracking
  payout_id UUID, -- Link to commission_payouts
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Payout scheduling
  is_due_for_payout BOOLEAN DEFAULT false,
  payout_deadline DATE, -- Optional deadline for when commission should be paid
  payout_scheduled_date DATE, -- When the payout is scheduled to happen
  
  -- Pipeline stage tracking
  pipeline_stage_met BOOLEAN DEFAULT false, -- Has the required pipeline stage been reached?
  pipeline_stage_met_at TIMESTAMP WITH TIME ZONE, -- When the stage requirement was met
  current_pipeline_stage VARCHAR, -- Current stage of the opportunity
  
  -- Dispute handling
  is_disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Commission Splits - For splitting commissions between multiple people
CREATE TABLE IF NOT EXISTS commission_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID NOT NULL REFERENCES commission_records(id) ON DELETE CASCADE,
  
  -- Split recipient
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Split details
  split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_amount DECIMAL(12,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Commission Adjustments - Manual adjustments to commissions
CREATE TABLE IF NOT EXISTS commission_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  
  -- Adjustment details
  adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
    'bonus', 'deduction', 'correction', 'clawback'
  )),
  adjustment_amount DECIMAL(12,2) NOT NULL, -- Positive for additions, negative for deductions
  adjustment_reason TEXT NOT NULL,
  
  -- Approval
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to existing commission_calculations table if they don't exist
DO $$ 
BEGIN
  -- Add event_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'event_id') THEN
    ALTER TABLE commission_calculations ADD COLUMN event_id UUID REFERENCES commission_events(id);
  END IF;
  
  -- Add assignment_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'assignment_id') THEN
    ALTER TABLE commission_calculations ADD COLUMN assignment_id UUID REFERENCES commission_assignments(id);
  END IF;
  
  -- Add payout scheduling columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'is_due_for_payout') THEN
    ALTER TABLE commission_calculations ADD COLUMN is_due_for_payout BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'payout_deadline') THEN
    ALTER TABLE commission_calculations ADD COLUMN payout_deadline DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'payout_scheduled_date') THEN
    ALTER TABLE commission_calculations ADD COLUMN payout_scheduled_date DATE;
  END IF;
  
  -- Add pipeline stage tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'pipeline_stage_met') THEN
    ALTER TABLE commission_calculations ADD COLUMN pipeline_stage_met BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'pipeline_stage_met_at') THEN
    ALTER TABLE commission_calculations ADD COLUMN pipeline_stage_met_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'current_pipeline_stage') THEN
    ALTER TABLE commission_calculations ADD COLUMN current_pipeline_stage VARCHAR;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_events_org ON commission_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_opportunity ON commission_events(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_events_contact ON commission_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_date ON commission_events(event_date);
CREATE INDEX IF NOT EXISTS idx_commission_events_source_type ON commission_events(event_source, event_type);
CREATE INDEX IF NOT EXISTS idx_commission_events_opportunity_org ON commission_events(organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_commission_assignments_org ON commission_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_assignments_opportunity ON commission_assignments(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_assignments_team_member ON commission_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active ON commission_assignments(is_active, effective_date);

CREATE INDEX IF NOT EXISTS idx_commission_records_org ON commission_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_event ON commission_records(event_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_assignment ON commission_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_team_member ON commission_records(team_member_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_commission_records_payout ON commission_records(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_records_due_payout ON commission_records(is_due_for_payout, payout_deadline) WHERE is_due_for_payout = true;
CREATE INDEX IF NOT EXISTS idx_commission_records_payout_deadline ON commission_records(payout_deadline) WHERE payout_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_splits_record ON commission_splits(commission_record_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_org ON commission_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_record ON commission_adjustments(commission_record_id);

-- Also update commission_calculations indexes for payout tracking
CREATE INDEX IF NOT EXISTS idx_commission_calculations_due_payout ON commission_calculations(is_due_for_payout, payout_deadline) WHERE is_due_for_payout = true;
CREATE INDEX IF NOT EXISTS idx_commission_calculations_payout_deadline ON commission_calculations(payout_deadline) WHERE payout_deadline IS NOT NULL;

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_commission_events_updated_at 
  BEFORE UPDATE ON commission_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_assignments_updated_at 
  BEFORE UPDATE ON commission_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_records_updated_at 
  BEFORE UPDATE ON commission_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commission(
  p_event_id UUID,
  p_assignment_id UUID
) RETURNS TABLE (
  commission_amount DECIMAL(12,2),
  calculation_method VARCHAR(100),
  calculation_details JSONB
) AS $$
DECLARE
  v_event commission_events%ROWTYPE;
  v_assignment commission_assignments%ROWTYPE;
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(12,2);
  v_calculation_method VARCHAR(100);
  v_calculation_details JSONB;
BEGIN
  -- Get event and assignment details
  SELECT * INTO v_event FROM commission_events WHERE id = p_event_id;
  SELECT * INTO v_assignment FROM commission_assignments WHERE id = p_assignment_id;
  
  -- Determine commission rate based on event type
  v_commission_rate := v_assignment.base_rate;
  
  CASE v_event.event_type
    WHEN 'payment_collected' THEN
      v_commission_rate := COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate);
    WHEN 'estimate_sent' THEN
      v_commission_rate := COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate);
    WHEN 'invoice_paid' THEN
      v_commission_rate := COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate);
    WHEN 'opportunity_won' THEN
      v_commission_rate := COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate);
    ELSE
      v_commission_rate := v_assignment.base_rate;
  END CASE;
  
  -- Calculate commission based on type
  IF v_assignment.commission_type = 'percentage_gross' THEN
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'percentage_gross';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  ELSIF v_assignment.commission_type = 'fixed_amount' THEN
    v_commission_amount := v_assignment.fixed_amount;
    v_calculation_method := 'fixed_amount';
    v_calculation_details := jsonb_build_object(
      'fixed_amount', v_assignment.fixed_amount
    );
  ELSE
    -- Default to percentage gross
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'default_percentage';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  END IF;
  
  RETURN QUERY SELECT v_commission_amount, v_calculation_method, v_calculation_details;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create commission records when events occur
CREATE OR REPLACE FUNCTION process_commission_event()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_calc RECORD;
BEGIN
  -- Find applicable commission assignments
  FOR v_assignment IN
    SELECT * FROM commission_assignments
    WHERE organization_id = NEW.organization_id
      AND is_active = true
      AND effective_date <= CURRENT_DATE
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      AND (
        (assignment_type = 'opportunity' AND opportunity_id = NEW.opportunity_id) OR
        (assignment_type = 'global') OR
        (assignment_type = 'team_member' AND team_member_id IN (
          SELECT team_member_id FROM sales_transactions 
          WHERE opportunity_id = NEW.opportunity_id
          LIMIT 1
        ))
      )
    ORDER BY priority DESC
  LOOP
    -- Calculate commission
    SELECT * INTO v_calc FROM calculate_commission(NEW.id, v_assignment.id);
    
    -- Create commission record
    INSERT INTO commission_records (
      organization_id,
      event_id,
      assignment_id,
      team_member_id,
      ghl_user_id,
      user_name,
      user_email,
      base_amount,
      commission_rate,
      commission_amount,
      calculation_method,
      calculation_details,
      status
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      v_assignment.id,
      v_assignment.team_member_id,
      v_assignment.ghl_user_id,
      v_assignment.user_name,
      v_assignment.user_email,
      NEW.event_amount,
      CASE 
        WHEN v_assignment.commission_type LIKE 'percentage%' THEN
          CASE NEW.event_type
            WHEN 'payment_collected' THEN COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate)
            WHEN 'estimate_sent' THEN COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate)
            WHEN 'invoice_paid' THEN COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate)
            WHEN 'opportunity_won' THEN COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate)
            ELSE v_assignment.base_rate
          END
        ELSE NULL
      END,
      v_calc.commission_amount,
      v_calc.calculation_method,
      v_calc.calculation_details,
      'pending'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process commissions when events are created
CREATE TRIGGER process_commission_on_event 
  AFTER INSERT ON commission_events
  FOR EACH ROW EXECUTE FUNCTION process_commission_event();

-- Function to update commission payout status based on approval and stage requirements
CREATE OR REPLACE FUNCTION update_commission_payout_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_stage_required BOOLEAN := false;
BEGIN
  -- Get the assignment details to check for stage requirements
  SELECT * INTO v_assignment 
  FROM commission_assignments 
  WHERE id = NEW.assignment_id;
  
  -- Check if this assignment has pipeline stage requirements
  IF v_assignment.required_stage_id IS NOT NULL THEN
    v_stage_required := true;
  END IF;
  
  -- When a commission is approved, check if it can be marked as due for payout
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- If no stage requirement OR stage requirement is met, mark as due for payout
    IF NOT v_stage_required OR NEW.pipeline_stage_met = true THEN
      NEW.is_due_for_payout := true;
      -- Set default payout deadline to end of next month if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When pipeline stage requirement is met, check if commission should be due for payout
  IF NEW.pipeline_stage_met = true AND OLD.pipeline_stage_met = false THEN
    -- If commission is already approved, mark as due for payout
    IF NEW.status = 'approved' THEN
      NEW.is_due_for_payout := true;
      NEW.pipeline_stage_met_at := NOW();
      -- Set default payout deadline if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When a commission is paid, mark it as no longer due
  IF NEW.status = 'paid' THEN
    NEW.is_due_for_payout := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update payout status
CREATE TRIGGER update_payout_status_on_commission_change
  BEFORE UPDATE ON commission_records
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.pipeline_stage_met IS DISTINCT FROM NEW.pipeline_stage_met)
  EXECUTE FUNCTION update_commission_payout_status();

-- Also add the trigger to commission_calculations for backwards compatibility
CREATE TRIGGER update_payout_status_on_calculation_change
  BEFORE UPDATE ON commission_calculations
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.pipeline_stage_met IS DISTINCT FROM NEW.pipeline_stage_met)
  EXECUTE FUNCTION update_commission_payout_status();

-- Function to update commission records when opportunity stage changes
CREATE OR REPLACE FUNCTION update_commissions_on_stage_change(
  p_organization_id UUID,
  p_opportunity_id VARCHAR,
  p_pipeline_id VARCHAR,
  p_stage_id VARCHAR,
  p_stage_name VARCHAR
) RETURNS void AS $$
DECLARE
  v_commission RECORD;
  v_assignment commission_assignments%ROWTYPE;
BEGIN
  -- Find all commission records for this opportunity that are waiting for a stage
  FOR v_commission IN 
    SELECT cr.*, ca.required_stage_id, ca.required_pipeline_id, ca.stage_requirement_type
    FROM commission_records cr
    JOIN commission_assignments ca ON ca.id = cr.assignment_id
    JOIN commission_events ce ON ce.id = cr.event_id
    WHERE ce.organization_id = p_organization_id
      AND ce.opportunity_id = p_opportunity_id
      AND cr.pipeline_stage_met = false
      AND ca.required_stage_id IS NOT NULL
  LOOP
    -- Check if the stage requirement is met
    IF (v_commission.required_pipeline_id IS NULL OR v_commission.required_pipeline_id = p_pipeline_id)
       AND v_commission.required_stage_id = p_stage_id THEN
      -- Update the commission record
      UPDATE commission_records
      SET 
        pipeline_stage_met = true,
        pipeline_stage_met_at = NOW(),
        current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    ELSE
      -- Just update the current stage
      UPDATE commission_records
      SET current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    END IF;
  END LOOP;
  
  -- Also update commission_calculations for backwards compatibility
  FOR v_commission IN 
    SELECT cc.*, ca.required_stage_id, ca.required_pipeline_id, ca.stage_requirement_type
    FROM commission_calculations cc
    JOIN commission_assignments ca ON ca.id = cc.assignment_id
    WHERE cc.organization_id = p_organization_id
      AND cc.opportunity_id = p_opportunity_id
      AND cc.pipeline_stage_met = false
      AND ca.required_stage_id IS NOT NULL
  LOOP
    -- Check if the stage requirement is met
    IF (v_commission.required_pipeline_id IS NULL OR v_commission.required_pipeline_id = p_pipeline_id)
       AND v_commission.required_stage_id = p_stage_id THEN
      -- Update the commission calculation
      UPDATE commission_calculations
      SET 
        pipeline_stage_met = true,
        pipeline_stage_met_at = NOW(),
        current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    ELSE
      -- Just update the current stage
      UPDATE commission_calculations
      SET current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for opportunity commissions (for backwards compatibility)
CREATE OR REPLACE VIEW opportunity_commissions AS
SELECT 
  ca.id,
  ca.organization_id,
  ca.opportunity_id,
  ca.team_member_id,
  ca.ghl_user_id,
  ca.user_name,
  ca.user_email,
  CASE 
    WHEN ca.commission_type LIKE 'percentage%' THEN ca.commission_type
    ELSE 'custom'
  END as commission_type,
  ca.base_rate as commission_percentage,
  ca.notes,
  ca.created_at,
  ca.updated_at
FROM commission_assignments ca
WHERE ca.assignment_type = 'opportunity'
  AND ca.is_active = true;

-- Create view for commissions pending stage requirements
CREATE OR REPLACE VIEW commissions_pending_stage AS
SELECT 
  cr.id,
  cr.organization_id,
  ce.opportunity_id,
  cr.team_member_id,
  cr.user_name,
  cr.commission_amount,
  cr.status,
  cr.current_pipeline_stage,
  ca.required_pipeline_id,
  ca.required_stage_id,
  ca.required_stage_name,
  ca.stage_requirement_type,
  cr.pipeline_stage_met,
  cr.is_due_for_payout,
  cr.payout_deadline
FROM commission_records cr
JOIN commission_assignments ca ON ca.id = cr.assignment_id
JOIN commission_events ce ON ce.id = cr.event_id
WHERE ca.required_stage_id IS NOT NULL
  AND cr.pipeline_stage_met = false
  AND cr.status = 'approved';

-- Create view for commissions ready for payout
CREATE OR REPLACE VIEW commissions_ready_for_payout AS
SELECT 
  cr.id,
  cr.organization_id,
  cr.team_member_id,
  cr.user_name,
  cr.user_email,
  cr.commission_amount,
  cr.currency,
  ce.opportunity_id,
  ce.event_type,
  ce.event_date,
  cr.payout_deadline,
  cr.pipeline_stage_met,
  cr.pipeline_stage_met_at,
  cr.approved_at
FROM commission_records cr
JOIN commission_events ce ON ce.id = cr.event_id
WHERE cr.is_due_for_payout = true
  AND cr.status = 'approved'
  AND cr.payout_id IS NULL
ORDER BY cr.payout_deadline, cr.approved_at;

-- Create RLS policies
CREATE POLICY "Organization members can view commission data" ON commission_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_events.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can manage commission assignments" ON commission_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_assignments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view commission records" ON commission_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_records.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view commission splits" ON commission_splits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM commission_records cr
      JOIN organization_members om ON om.organization_id = cr.organization_id
      WHERE cr.id = commission_splits.commission_record_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage commission adjustments" ON commission_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_adjustments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );


-- ========================================
-- Migration: 016_product_commission_system.sql
-- ========================================
-- 016_product_commission_system.sql
-- Product-based commission tracking, recurring revenue, and gamification

-- 1. Product-specific commission rules
CREATE TABLE commission_product_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ghl_products(id) ON DELETE CASCADE,
  
  -- Commission rates
  initial_sale_rate DECIMAL(5,2) DEFAULT 10 CHECK (initial_sale_rate >= 0 AND initial_sale_rate <= 100),
  renewal_rate DECIMAL(5,2) DEFAULT 5 CHECK (renewal_rate >= 0 AND renewal_rate <= 100),
  
  -- MRR settings
  mrr_commission_type VARCHAR(50) DEFAULT 'duration' CHECK (mrr_commission_type IN (
    'first_payment_only', 'duration', 'lifetime', 'trailing'
  )),
  mrr_duration_months INTEGER DEFAULT 12,
  trailing_months INTEGER DEFAULT 6,
  
  -- Clawback rules
  clawback_enabled BOOLEAN DEFAULT false,
  clawback_period_days INTEGER DEFAULT 90,
  clawback_percentage DECIMAL(5,2) DEFAULT 100,
  
  -- Special rules
  min_sale_amount DECIMAL(10,2),
  max_commission_amount DECIMAL(10,2),
  requires_manager_approval BOOLEAN DEFAULT false,
  approval_threshold DECIMAL(10,2),
  
  -- Product margin validation
  max_commission_of_margin DECIMAL(5,2) DEFAULT 50, -- Max % of profit margin
  estimated_margin_percentage DECIMAL(5,2), -- Product profit margin
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, product_id, effective_date)
);

-- 2. Recurring commission tracking
CREATE TABLE recurring_commission_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  product_id UUID NOT NULL REFERENCES ghl_products(id),
  subscription_id VARCHAR NOT NULL,
  
  -- Tracking details
  tracking_type VARCHAR(50) NOT NULL CHECK (tracking_type IN (
    'initial', 'renewal', 'trailing', 'clawback'
  )),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_number INTEGER NOT NULL, -- Which payment period this is
  
  -- Commission details
  base_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'pending', 'earned', 'paid', 'clawedback', 'cancelled'
  )),
  earned_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Subscription lifecycle tracking
CREATE TABLE subscription_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id VARCHAR NOT NULL,
  product_id UUID REFERENCES ghl_products(id),
  contact_id VARCHAR NOT NULL,
  
  -- Lifecycle events
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'created', 'activated', 'renewed', 'upgraded', 'downgraded', 
    'paused', 'resumed', 'cancelled', 'expired', 'payment_failed'
  )),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Subscription details at time of event
  mrr_amount DECIMAL(10,2),
  billing_cycle VARCHAR(50),
  next_billing_date DATE,
  
  -- Impact on commissions
  commission_impact VARCHAR(50) CHECK (commission_impact IN (
    'new_commission', 'continue_commission', 'pause_commission', 
    'stop_commission', 'clawback_triggered', NULL
  )),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Gamification challenges
CREATE TABLE gamification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Challenge details
  challenge_name VARCHAR(255) NOT NULL,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'product_sales', 'revenue_target', 'new_products', 'team_competition', 
    'personal_best', 'streak', 'milestone'
  )),
  description TEXT,
  
  -- Target configuration
  target_metric VARCHAR(100) NOT NULL, -- e.g., 'product_count', 'revenue', 'mrr'
  target_value DECIMAL(12,2) NOT NULL,
  target_product_ids JSONB DEFAULT '[]', -- Specific products for the challenge
  
  -- Timeframe
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Rewards
  reward_type VARCHAR(50) CHECK (reward_type IN (
    'bonus_percentage', 'fixed_bonus', 'achievement', 'multiplier'
  )),
  reward_value DECIMAL(10,2),
  achievement_badge VARCHAR(100),
  
  -- Participation
  participant_type VARCHAR(50) DEFAULT 'individual' CHECK (participant_type IN (
    'individual', 'team', 'organization'
  )),
  eligible_team_members JSONB DEFAULT '[]', -- Empty = all eligible
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 5. Achievement tracking
CREATE TABLE gamification_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  challenge_id UUID REFERENCES gamification_challenges(id),
  
  -- Achievement details
  achievement_type VARCHAR(100) NOT NULL,
  achievement_name VARCHAR(255) NOT NULL,
  achievement_level VARCHAR(50), -- bronze, silver, gold, platinum
  
  -- Progress tracking
  current_value DECIMAL(12,2) DEFAULT 0,
  target_value DECIMAL(12,2),
  progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN target_value > 0 THEN (current_value / target_value * 100)
      ELSE 0 
    END
  ) STORED,
  
  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Reward tracking
  reward_earned DECIMAL(10,2),
  reward_paid BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(team_member_id, challenge_id)
);

-- 6. Leaderboard snapshots
CREATE TABLE gamification_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Leaderboard details
  leaderboard_type VARCHAR(50) NOT NULL CHECK (leaderboard_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'all_time', 'challenge'
  )),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  challenge_id UUID REFERENCES gamification_challenges(id),
  
  -- Rankings (stored as JSONB for flexibility and performance)
  rankings JSONB NOT NULL, -- Array of {team_member_id, rank, score, metrics}
  
  -- Metadata
  metric_type VARCHAR(100) NOT NULL,
  total_participants INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Product performance analytics
CREATE TABLE product_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ghl_products(id),
  
  -- Time period
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  
  -- Sales metrics
  units_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  avg_sale_price DECIMAL(10,2),
  
  -- Performance metrics
  conversion_rate DECIMAL(5,2),
  days_to_sale_avg DECIMAL(6,2),
  return_rate DECIMAL(5,2),
  
  -- Commission metrics
  total_commissions_paid DECIMAL(12,2) DEFAULT 0,
  avg_commission_rate DECIMAL(5,2),
  
  -- Top performers
  top_performers JSONB DEFAULT '[]', -- Array of {team_member_id, units, revenue}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, product_id, snapshot_date, period_type)
);

-- 8. Commission validation audit
CREATE TABLE commission_validation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  
  -- Validation results
  validation_status VARCHAR(50) NOT NULL CHECK (validation_status IN (
    'passed', 'warning', 'failed', 'override'
  )),
  
  -- Validation checks performed
  checks_performed JSONB NOT NULL, -- Array of {check_name, result, message}
  
  -- Override details (if applicable)
  override_reason TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMP WITH TIME ZONE,
  
  -- Manager approval (if required)
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50) CHECK (approval_status IN (
    'pending', 'approved', 'rejected', NULL
  )),
  approved_by UUID REFERENCES users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_commission_product_rules_org ON commission_product_rules(organization_id);
CREATE INDEX idx_commission_product_rules_product ON commission_product_rules(product_id);
CREATE INDEX idx_commission_product_rules_active ON commission_product_rules(is_active, effective_date);

CREATE INDEX idx_recurring_tracking_org ON recurring_commission_tracking(organization_id);
CREATE INDEX idx_recurring_tracking_subscription ON recurring_commission_tracking(subscription_id);
CREATE INDEX idx_recurring_tracking_status ON recurring_commission_tracking(status);
CREATE INDEX idx_recurring_tracking_period ON recurring_commission_tracking(period_start, period_end);

CREATE INDEX idx_subscription_lifecycle_org ON subscription_lifecycle(organization_id);
CREATE INDEX idx_subscription_lifecycle_subscription ON subscription_lifecycle(subscription_id);
CREATE INDEX idx_subscription_lifecycle_event ON subscription_lifecycle(event_type, event_date);

CREATE INDEX idx_gamification_challenges_org ON gamification_challenges(organization_id);
CREATE INDEX idx_gamification_challenges_active ON gamification_challenges(is_active, start_date, end_date);

CREATE INDEX idx_gamification_achievements_member ON gamification_achievements(team_member_id);
CREATE INDEX idx_gamification_achievements_challenge ON gamification_achievements(challenge_id);
CREATE INDEX idx_gamification_achievements_completed ON gamification_achievements(completed_at) WHERE completed_at IS NOT NULL;

CREATE INDEX idx_gamification_leaderboards_org ON gamification_leaderboards(organization_id);
CREATE INDEX idx_gamification_leaderboards_period ON gamification_leaderboards(period_start, period_end);

CREATE INDEX idx_product_analytics_org ON product_analytics_snapshots(organization_id);
CREATE INDEX idx_product_analytics_product ON product_analytics_snapshots(product_id);
CREATE INDEX idx_product_analytics_date ON product_analytics_snapshots(snapshot_date);

CREATE INDEX idx_validation_audit_commission ON commission_validation_audit(commission_record_id);
CREATE INDEX idx_validation_audit_approval ON commission_validation_audit(requires_approval, approval_status);

-- Add product_id to commission_assignments for product-specific assignments
-- Note: subscription_initial_rate and subscription_renewal_rate already exist from migration 014
ALTER TABLE commission_assignments 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES ghl_products(id),
ADD COLUMN IF NOT EXISTS mrr_duration_months INTEGER,
ADD COLUMN IF NOT EXISTS trailing_commission_months INTEGER;

-- Add product_id to commission_events for product sales tracking
ALTER TABLE commission_events
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES ghl_products(id),
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR;

-- Create triggers
CREATE TRIGGER update_commission_product_rules_updated_at 
  BEFORE UPDATE ON commission_product_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_tracking_updated_at 
  BEFORE UPDATE ON recurring_commission_tracking 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_challenges_updated_at 
  BEFORE UPDATE ON gamification_challenges 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_achievements_updated_at 
  BEFORE UPDATE ON gamification_achievements 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE commission_product_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_commission_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_validation_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization members can manage product commission rules" ON commission_product_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_product_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view recurring commissions" ON recurring_commission_tracking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = recurring_commission_tracking.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view subscription lifecycle" ON subscription_lifecycle
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = subscription_lifecycle.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view challenges" ON gamification_challenges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = gamification_challenges.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Team members can view their achievements" ON gamification_achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN organization_members om ON om.organization_id = tm.organization_id
      WHERE tm.id = gamification_achievements.team_member_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view leaderboards" ON gamification_leaderboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = gamification_leaderboards.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view product analytics" ON product_analytics_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = product_analytics_snapshots.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view validation audits" ON commission_validation_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_records cr
      JOIN organization_members om ON om.organization_id = cr.organization_id
      WHERE cr.id = commission_validation_audit.commission_record_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Helper function to calculate recurring commissions
CREATE OR REPLACE FUNCTION calculate_recurring_commission(
  p_subscription_id VARCHAR,
  p_product_id UUID,
  p_period_number INTEGER,
  p_amount DECIMAL(10,2)
) RETURNS TABLE (
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  tracking_type VARCHAR(50)
) AS $$
DECLARE
  v_rule commission_product_rules%ROWTYPE;
  v_rate DECIMAL(5,2);
  v_type VARCHAR(50);
BEGIN
  -- Get the product commission rule
  SELECT * INTO v_rule 
  FROM commission_product_rules 
  WHERE product_id = p_product_id 
    AND is_active = true 
    AND CURRENT_DATE BETWEEN COALESCE(effective_date, CURRENT_DATE) AND COALESCE(expiry_date, CURRENT_DATE)
  ORDER BY priority DESC 
  LIMIT 1;
  
  -- Determine commission rate and type based on period
  IF p_period_number = 1 THEN
    v_rate := COALESCE(v_rule.initial_sale_rate, 10);
    v_type := 'initial';
  ELSIF v_rule.mrr_commission_type = 'first_payment_only' THEN
    RETURN; -- No commission after first payment
  ELSIF v_rule.mrr_commission_type = 'duration' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) THEN
    RETURN; -- Duration exceeded
  ELSIF v_rule.mrr_commission_type = 'trailing' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) + COALESCE(v_rule.trailing_months, 6) THEN
    RETURN; -- Trailing period exceeded
  ELSIF v_rule.mrr_commission_type = 'trailing' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) THEN
    v_rate := COALESCE(v_rule.renewal_rate, 5) * 0.5; -- Reduced rate for trailing
    v_type := 'trailing';
  ELSE
    v_rate := COALESCE(v_rule.renewal_rate, 5);
    v_type := 'renewal';
  END IF;
  
  RETURN QUERY SELECT 
    v_rate,
    p_amount * (v_rate / 100),
    v_type;
END;
$$ LANGUAGE plpgsql;

-- Function to check commission validation rules
CREATE OR REPLACE FUNCTION validate_commission(
  p_commission_record_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_commission commission_records%ROWTYPE;
  v_event commission_events%ROWTYPE;
  v_product ghl_products%ROWTYPE;
  v_rule commission_product_rules%ROWTYPE;
  v_checks JSONB := '[]'::JSONB;
  v_status VARCHAR(50) := 'passed';
  v_requires_approval BOOLEAN := false;
BEGIN
  -- Get commission details
  SELECT * INTO v_commission FROM commission_records WHERE id = p_commission_record_id;
  SELECT * INTO v_event FROM commission_events WHERE id = v_commission.event_id;
  
  -- If product-based, get product and rules
  IF v_event.product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM ghl_products WHERE id = v_event.product_id;
    SELECT * INTO v_rule FROM commission_product_rules 
    WHERE product_id = v_event.product_id 
      AND is_active = true 
    ORDER BY priority DESC 
    LIMIT 1;
    
    -- Check 1: Product active status
    IF NOT v_product.is_active THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'product_active',
        'result', 'failed',
        'message', 'Product is not active'
      );
      v_status := 'failed';
    END IF;
    
    -- Check 2: Commission vs margin
    IF v_rule.estimated_margin_percentage IS NOT NULL AND v_rule.max_commission_of_margin IS NOT NULL THEN
      IF (v_commission.commission_rate > (v_rule.estimated_margin_percentage * v_rule.max_commission_of_margin / 100)) THEN
        v_checks := v_checks || jsonb_build_object(
          'check_name', 'margin_check',
          'result', 'warning',
          'message', 'Commission exceeds allowed percentage of profit margin'
        );
        IF v_status != 'failed' THEN v_status := 'warning'; END IF;
      END IF;
    END IF;
    
    -- Check 3: Min/Max amounts
    IF v_rule.min_sale_amount IS NOT NULL AND v_event.event_amount < v_rule.min_sale_amount THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'min_amount',
        'result', 'failed',
        'message', 'Sale amount below minimum for commission'
      );
      v_status := 'failed';
    END IF;
    
    IF v_rule.max_commission_amount IS NOT NULL AND v_commission.commission_amount > v_rule.max_commission_amount THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'max_commission',
        'result', 'warning',
        'message', 'Commission exceeds maximum allowed amount'
      );
      IF v_status != 'failed' THEN v_status := 'warning'; END IF;
    END IF;
    
    -- Check 4: Manager approval required
    IF v_rule.requires_manager_approval OR 
       (v_rule.approval_threshold IS NOT NULL AND v_commission.commission_amount > v_rule.approval_threshold) THEN
      v_requires_approval := true;
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'approval_required',
        'result', 'info',
        'message', 'Manager approval required for this commission'
      );
    END IF;
  END IF;
  
  -- Return validation results
  RETURN jsonb_build_object(
    'status', v_status,
    'requires_approval', v_requires_approval,
    'checks', v_checks
  );
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- Migration: 017_estimates_invoices_integration.sql
-- ========================================
-- 017_estimates_invoices_integration.sql
-- Creates dedicated estimates and invoices tables with proper relationships to opportunities and commission tracking

-- 1. Estimates Table - Store estimate data with opportunity linkage
CREATE TABLE ghl_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_estimate_id VARCHAR(255) NOT NULL,
  estimate_number VARCHAR(255),
  
  -- Opportunity relationship (can be created from opportunity or standalone)
  opportunity_id VARCHAR(255), -- GHL opportunity ID
  contact_id VARCHAR(255) NOT NULL, -- GHL contact ID
  
  -- Estimate details
  name VARCHAR(500) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'
  )),
  
  -- Dates
  created_date TIMESTAMP WITH TIME ZONE,
  sent_date TIMESTAMP WITH TIME ZONE,
  viewed_date TIMESTAMP WITH TIME ZONE,
  response_date TIMESTAMP WITH TIME ZONE, -- When accepted/declined
  expiry_date TIMESTAMP WITH TIME ZONE,
  
  -- Conversion tracking
  converted_to_invoice BOOLEAN DEFAULT FALSE,
  converted_invoice_id UUID, -- References ghl_invoices.id when converted
  
  -- Line items and metadata
  line_items JSONB DEFAULT '[]',
  terms TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Sync tracking
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, ghl_estimate_id)
);

-- 2. Invoices Table - Store invoice data with estimate and opportunity linkage
CREATE TABLE ghl_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_invoice_id VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(255),
  
  -- Source relationships
  opportunity_id VARCHAR(255), -- GHL opportunity ID (can be created from opportunity)
  estimate_id UUID REFERENCES ghl_estimates(id), -- Internal estimate ID if converted from estimate
  contact_id VARCHAR(255) NOT NULL, -- GHL contact ID
  
  -- Invoice details
  name VARCHAR(500) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled'
  )),
  
  -- Payment tracking
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) GENERATED ALWAYS AS (amount - amount_paid) STORED,
  
  -- Dates
  created_date TIMESTAMP WITH TIME ZONE,
  sent_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_date TIMESTAMP WITH TIME ZONE,
  
  -- Line items and metadata
  line_items JSONB DEFAULT '[]',
  payment_terms VARCHAR(255),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Sync tracking
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, ghl_invoice_id)
);

-- 3. Add foreign key constraint for estimate-to-invoice conversion
ALTER TABLE ghl_estimates 
ADD CONSTRAINT fk_estimates_converted_invoice 
FOREIGN KEY (converted_invoice_id) REFERENCES ghl_invoices(id) ON DELETE SET NULL;

-- 4. Estimate Status History - Track status changes for estimates
CREATE TABLE ghl_estimate_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES ghl_estimates(id) ON DELETE CASCADE,
  
  -- Status change details
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by VARCHAR(255), -- GHL user who made the change
  
  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 5. Invoice Status History - Track status changes for invoices
CREATE TABLE ghl_invoice_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES ghl_invoices(id) ON DELETE CASCADE,
  
  -- Status change details
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by VARCHAR(255), -- GHL user who made the change
  
  -- Payment details (for payment-related status changes)
  payment_amount DECIMAL(12,2),
  payment_method VARCHAR(255),
  transaction_id VARCHAR(255),
  
  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 6. Create indexes for performance
CREATE INDEX idx_ghl_estimates_organization ON ghl_estimates(organization_id);
CREATE INDEX idx_ghl_estimates_ghl_id ON ghl_estimates(ghl_estimate_id);
CREATE INDEX idx_ghl_estimates_opportunity ON ghl_estimates(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_ghl_estimates_contact ON ghl_estimates(contact_id);
CREATE INDEX idx_ghl_estimates_status ON ghl_estimates(status);
CREATE INDEX idx_ghl_estimates_converted ON ghl_estimates(converted_to_invoice) WHERE converted_to_invoice = TRUE;

CREATE INDEX idx_ghl_invoices_organization ON ghl_invoices(organization_id);
CREATE INDEX idx_ghl_invoices_ghl_id ON ghl_invoices(ghl_invoice_id);
CREATE INDEX idx_ghl_invoices_opportunity ON ghl_invoices(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_ghl_invoices_estimate ON ghl_invoices(estimate_id) WHERE estimate_id IS NOT NULL;
CREATE INDEX idx_ghl_invoices_contact ON ghl_invoices(contact_id);
CREATE INDEX idx_ghl_invoices_status ON ghl_invoices(status);
CREATE INDEX idx_ghl_invoices_due_date ON ghl_invoices(due_date) WHERE status IN ('sent', 'viewed', 'partially_paid');

CREATE INDEX idx_estimate_status_history_estimate ON ghl_estimate_status_history(estimate_id, changed_at);
CREATE INDEX idx_invoice_status_history_invoice ON ghl_invoice_status_history(invoice_id, changed_at);

-- 7. Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_ghl_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ghl_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers for updated_at
CREATE TRIGGER trigger_ghl_estimates_updated_at
  BEFORE UPDATE ON ghl_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_estimates_updated_at();

CREATE TRIGGER trigger_ghl_invoices_updated_at
  BEFORE UPDATE ON ghl_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_invoices_updated_at();

-- 9. Create trigger functions for status history tracking
CREATE OR REPLACE FUNCTION track_estimate_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ghl_estimate_status_history (
      estimate_id,
      from_status,
      to_status,
      changed_at,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NOW(),
      jsonb_build_object('trigger', 'automatic')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION track_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ghl_invoice_status_history (
      invoice_id,
      from_status,
      to_status,
      changed_at,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NOW(),
      jsonb_build_object('trigger', 'automatic')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create triggers for status history
CREATE TRIGGER trigger_estimate_status_history
  AFTER UPDATE ON ghl_estimates
  FOR EACH ROW
  EXECUTE FUNCTION track_estimate_status_change();

CREATE TRIGGER trigger_invoice_status_history
  AFTER UPDATE ON ghl_invoices
  FOR EACH ROW
  EXECUTE FUNCTION track_invoice_status_change();

-- 11. Create a function to convert estimate to invoice
CREATE OR REPLACE FUNCTION convert_estimate_to_invoice(
  p_estimate_id UUID,
  p_ghl_invoice_id VARCHAR(255),
  p_invoice_number VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_estimate ghl_estimates%ROWTYPE;
  v_invoice_id UUID;
BEGIN
  -- Get the estimate
  SELECT * INTO v_estimate FROM ghl_estimates WHERE id = p_estimate_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found: %', p_estimate_id;
  END IF;
  
  -- Create the invoice
  INSERT INTO ghl_invoices (
    organization_id,
    integration_id,
    ghl_invoice_id,
    invoice_number,
    opportunity_id,
    estimate_id,
    contact_id,
    name,
    description,
    amount,
    currency,
    line_items,
    notes,
    metadata,
    created_date
  ) VALUES (
    v_estimate.organization_id,
    v_estimate.integration_id,
    p_ghl_invoice_id,
    p_invoice_number,
    v_estimate.opportunity_id,
    p_estimate_id,
    v_estimate.contact_id,
    v_estimate.name,
    v_estimate.description,
    v_estimate.amount,
    v_estimate.currency,
    v_estimate.line_items,
    v_estimate.notes,
    v_estimate.metadata,
    NOW()
  ) RETURNING id INTO v_invoice_id;
  
  -- Update the estimate to mark it as converted
  UPDATE ghl_estimates 
  SET 
    converted_to_invoice = TRUE,
    converted_invoice_id = v_invoice_id,
    status = CASE WHEN status = 'accepted' THEN 'accepted' ELSE 'converted' END,
    updated_at = NOW()
  WHERE id = p_estimate_id;
  
  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- 12. Create views for easier querying
CREATE VIEW estimates_with_conversions AS
SELECT 
  e.*,
  i.ghl_invoice_id as converted_invoice_ghl_id,
  i.invoice_number as converted_invoice_number,
  i.status as converted_invoice_status,
  i.amount_paid as converted_invoice_amount_paid
FROM ghl_estimates e
LEFT JOIN ghl_invoices i ON e.converted_invoice_id = i.id;

CREATE VIEW invoices_with_sources AS
SELECT 
  i.*,
  e.ghl_estimate_id as source_estimate_ghl_id,
  e.estimate_number as source_estimate_number,
  e.status as source_estimate_status,
  CASE 
    WHEN e.id IS NOT NULL THEN 'estimate'
    WHEN i.opportunity_id IS NOT NULL THEN 'opportunity'
    ELSE 'direct'
  END as source_type
FROM ghl_invoices i
LEFT JOIN ghl_estimates e ON i.estimate_id = e.id;

-- 13. Update RLS policies
ALTER TABLE ghl_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_estimate_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_invoice_status_history ENABLE ROW LEVEL SECURITY;

-- Estimates policies
CREATE POLICY "Users can view estimates in their organization" ON ghl_estimates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert estimates in their organization" ON ghl_estimates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update estimates in their organization" ON ghl_estimates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Invoices policies
CREATE POLICY "Users can view invoices in their organization" ON ghl_invoices
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices in their organization" ON ghl_invoices
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices in their organization" ON ghl_invoices
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Status history policies (read-only for users)
CREATE POLICY "Users can view estimate status history in their organization" ON ghl_estimate_status_history
  FOR SELECT USING (
    estimate_id IN (
      SELECT id FROM ghl_estimates 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view invoice status history in their organization" ON ghl_invoice_status_history
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM ghl_invoices 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service role policies (for API access)
CREATE POLICY "Service role can manage all estimates" ON ghl_estimates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all invoices" ON ghl_invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all estimate status history" ON ghl_estimate_status_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all invoice status history" ON ghl_invoice_status_history
  FOR ALL USING (auth.role() = 'service_role');


-- ========================================
-- Migration: 20250228_add_assigned_user_to_opportunities.sql
-- ========================================
-- Add assigned user columns to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);

-- Create index for assigned_to for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_assigned_to 
ON opportunity_cache(assigned_to) 
WHERE assigned_to IS NOT NULL;


-- ========================================
-- Migration: 20250731_add_commission_disable_flag.sql
-- ========================================
-- Add is_disabled flag to commission_assignments to allow disabling commission while keeping assignment
ALTER TABLE commission_assignments 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN commission_assignments.is_disabled IS 'When true, commission is assigned but disabled (0% rate) for this specific opportunity';

-- Create index for efficient querying of active, non-disabled commissions
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active_not_disabled 
ON commission_assignments(organization_id, opportunity_id, is_active, is_disabled) 
WHERE is_active = true AND is_disabled = false;


-- ========================================
-- Migration: 20250731_add_is_disabled_to_commission_assignments.sql
-- ========================================
-- Add is_disabled column to commission_assignments table
-- This allows temporarily disabling a commission assignment without deleting it

ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN commission_assignments.is_disabled IS 'Whether this commission assignment is temporarily disabled';

-- Create index for performance when filtering active assignments
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active 
ON commission_assignments(organization_id, opportunity_id, is_active, is_disabled)
WHERE is_active = true AND (is_disabled IS NULL OR is_disabled = false);


-- ========================================
-- Migration: 20250731_add_payment_tracking_to_commission_assignments.sql
-- ========================================
-- Add payment tracking columns to commission_assignments table

ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN commission_assignments.is_paid IS 'Whether this commission has been paid out';
COMMENT ON COLUMN commission_assignments.paid_date IS 'Date when the commission was paid';
COMMENT ON COLUMN commission_assignments.paid_amount IS 'Actual amount paid (may differ from calculated amount)';
COMMENT ON COLUMN commission_assignments.payment_reference IS 'Reference number for the payment (check number, transfer ID, etc)';

-- Create index for performance when filtering paid/unpaid commissions
CREATE INDEX IF NOT EXISTS idx_commission_assignments_paid_status 
ON commission_assignments(organization_id, is_paid, is_active)
WHERE is_active = true;


-- ========================================
-- Migration: 20250731_ghl_calendars.sql
-- ========================================
-- Create table for storing GoHighLevel calendars
CREATE TABLE IF NOT EXISTS ghl_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  calendar_id VARCHAR(255) NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calendar_type VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, calendar_id)
);

-- Create index for faster lookups
CREATE INDEX idx_ghl_calendars_org_id ON ghl_calendars(organization_id);
CREATE INDEX idx_ghl_calendars_integration_id ON ghl_calendars(integration_id);
CREATE INDEX idx_ghl_calendars_location_id ON ghl_calendars(location_id);
CREATE INDEX idx_ghl_calendars_calendar_id ON ghl_calendars(calendar_id);

-- Add RLS policies
ALTER TABLE ghl_calendars ENABLE ROW LEVEL SECURITY;

-- Policy for organization members to view calendars
CREATE POLICY "Organization members can view calendars" ON ghl_calendars
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for organization admins to manage calendars
CREATE POLICY "Organization admins can manage calendars" ON ghl_calendars
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ghl_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_ghl_calendars_updated_at
  BEFORE UPDATE ON ghl_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_calendars_updated_at();

