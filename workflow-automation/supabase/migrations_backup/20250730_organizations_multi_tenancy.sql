-- Multi-tenancy support: Organizations and team management
-- This migration adds proper multi-tenancy with organizations, roles, and permissions

-- 1. Create organizations table (master account structure)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
  
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
  features JSONB DEFAULT '[]', -- Array of enabled features
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- Will reference auth.users
  is_active BOOLEAN DEFAULT true
);

-- 2. Create organization_members table (link users to organizations with roles)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users from Supabase Auth
  
  -- Role-based access
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'administrator', 'sales', 'bot_trainer', 'viewer')),
  
  -- Permissions override (for custom permissions beyond role defaults)
  custom_permissions JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  invited_by UUID,
  invited_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure user can only belong to one organization with one role
  UNIQUE(organization_id, user_id)
);

-- 3. Create team_members table (replaces scattered ghl_user_id references)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Member information
  external_id VARCHAR(255), -- For GHL user IDs or other external systems
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Link to platform user (if they have login access)
  user_id UUID, -- References auth.users if they can log in
  organization_member_id UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  
  -- Member type and status
  member_type VARCHAR(50) DEFAULT 'sales' CHECK (member_type IN ('sales', 'support', 'operations', 'management')),
  is_active BOOLEAN DEFAULT true,
  
  -- Commission and payment settings (for sales members)
  commission_rate DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_type VARCHAR(50) DEFAULT 'gross' CHECK (commission_type IN ('gross', 'profit', 'tiered', 'flat')),
  payment_structure JSONB DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique members per organization
  UNIQUE(organization_id, email),
  UNIQUE(organization_id, external_id) -- Prevent duplicate GHL users
);

-- 4. Create permissions table (defines what each role can do)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL, -- e.g., 'workflows', 'bots', 'sales', 'commissions'
  actions JSONB NOT NULL DEFAULT '[]', -- Array of allowed actions: ['create', 'read', 'update', 'delete']
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(role, resource)
);

-- 5. Insert default role permissions
INSERT INTO role_permissions (role, resource, actions) VALUES
-- Owner: Full access to everything
('owner', 'organizations', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'members', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'workflows', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'bots', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'integrations', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'sales', '["create", "read", "update", "delete"]'::jsonb),
('owner', 'commissions', '["create", "read", "update", "delete", "approve"]'::jsonb),
('owner', 'billing', '["read", "update"]'::jsonb),

-- Administrator: Almost full access, except billing
('administrator', 'organizations', '["read", "update"]'::jsonb),
('administrator', 'members', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'workflows', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'bots', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'integrations', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'sales', '["create", "read", "update", "delete"]'::jsonb),
('administrator', 'commissions', '["create", "read", "update", "delete", "approve"]'::jsonb),

-- Sales: Access to GHL features, sales, and their own commissions
('sales', 'sales', '["create", "read", "update"]'::jsonb),
('sales', 'commissions', '["read"]'::jsonb), -- Can only view their own
('sales', 'contacts', '["create", "read", "update"]'::jsonb),
('sales', 'opportunities', '["create", "read", "update"]'::jsonb),
('sales', 'receipts', '["create", "read", "update"]'::jsonb),

-- Bot Trainer: Access to bot and workflow features
('bot_trainer', 'bots', '["create", "read", "update"]'::jsonb),
('bot_trainer', 'workflows', '["create", "read", "update"]'::jsonb),
('bot_trainer', 'conversations', '["read"]'::jsonb),

-- Viewer: Read-only access to most resources
('viewer', 'organizations', '["read"]'::jsonb),
('viewer', 'workflows', '["read"]'::jsonb),
('viewer', 'bots', '["read"]'::jsonb),
('viewer', 'sales', '["read"]'::jsonb),
('viewer', 'commissions', '["read"]'::jsonb);

-- 6. Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_status ON organization_members(status);

CREATE INDEX idx_team_members_org ON team_members(organization_id);
CREATE INDEX idx_team_members_email ON team_members(organization_id, email);
CREATE INDEX idx_team_members_external ON team_members(organization_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_team_members_user ON team_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_team_members_active ON team_members(organization_id, is_active) WHERE is_active = true;

CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- 7. Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON organizations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at 
  BEFORE UPDATE ON organization_members 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at 
  BEFORE UPDATE ON team_members 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at 
  BEFORE UPDATE ON role_permissions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for organizations
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Owners and admins can update organizations" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'administrator')
      AND om.status = 'active'
    )
  );

-- 10. Create RLS policies for organization_members
CREATE POLICY "Members can view their organization members" ON organization_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Owners and admins can manage members" ON organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'administrator')
      AND om.status = 'active'
    )
  );

-- 11. Create RLS policies for team_members
CREATE POLICY "Organization members can view team members" ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = team_members.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Admins can manage team members" ON team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = team_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'administrator')
      AND om.status = 'active'
    )
  );

-- 12. Create RLS policies for role_permissions (read-only for all authenticated users)
CREATE POLICY "All users can view role permissions" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 13. Create helper functions
CREATE OR REPLACE FUNCTION get_user_organization_id(p_user_id UUID)
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

CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID, p_organization_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role INTO v_role
  FROM organization_members
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id
  AND status = 'active';
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_resource VARCHAR, p_action VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
  v_has_permission BOOLEAN;
BEGIN
  -- Get user's role
  SELECT role INTO v_role
  FROM organization_members
  WHERE user_id = p_user_id
  AND status = 'active'
  LIMIT 1;
  
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if role has permission
  SELECT EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = v_role
    AND resource = p_resource
    AND actions @> to_jsonb(p_action)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Add comments
COMMENT ON TABLE organizations IS 'Master organization/account structure for multi-tenancy';
COMMENT ON TABLE organization_members IS 'Links users to organizations with specific roles';
COMMENT ON TABLE team_members IS 'All team members including sales reps, replacing scattered ghl_user_id references';
COMMENT ON TABLE role_permissions IS 'Defines permissions for each role';

COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier for the organization';
COMMENT ON COLUMN organizations.max_users IS 'Maximum users allowed based on subscription plan';
COMMENT ON COLUMN organization_members.role IS 'User role: owner, administrator, sales, bot_trainer, viewer';
COMMENT ON COLUMN team_members.external_id IS 'External system ID, e.g., GoHighLevel user ID';
COMMENT ON COLUMN team_members.user_id IS 'Links to auth.users if team member has platform login access';

-- Grant necessary permissions
GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON team_members TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission TO authenticated;