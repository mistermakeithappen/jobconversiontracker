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