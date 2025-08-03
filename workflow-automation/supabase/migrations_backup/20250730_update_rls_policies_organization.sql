-- Update all RLS policies to use organization-based access control
-- This migration replaces user_id based policies with organization-based policies

-- 1. Drop existing RLS policies
-- Core tables
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can create their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can update their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can delete their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can view their own executions" ON executions;
DROP POLICY IF EXISTS "Users can create executions for their workflows" ON executions;
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can manage their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can manage their own integrations" ON integrations;

-- GHL and commission tables
DROP POLICY IF EXISTS "Users can manage their own receipts" ON opportunity_receipts;
DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can manage their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their own products" ON ghl_products;
DROP POLICY IF EXISTS "Users can manage their own products" ON ghl_products;
DROP POLICY IF EXISTS "Users can view their own transactions" ON sales_transactions;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON sales_transactions;
DROP POLICY IF EXISTS "Users can view their own calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Users can manage their own calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Users can view their own payouts" ON commission_payouts;
DROP POLICY IF EXISTS "Users can manage their own payouts" ON commission_payouts;
DROP POLICY IF EXISTS "Users can view their own payout items" ON payout_line_items;
DROP POLICY IF EXISTS "Users can view their own GHL user commissions" ON ghl_user_commissions;
DROP POLICY IF EXISTS "Users can manage their own GHL user commissions" ON ghl_user_commissions;

-- Bot and chatbot tables
DROP POLICY IF EXISTS "Users can view their own bots" ON bots;
DROP POLICY IF EXISTS "Users can manage their own bots" ON bots;
DROP POLICY IF EXISTS "Users can view their own chatbot workflows" ON chatbot_workflows;
DROP POLICY IF EXISTS "Users can manage their own chatbot workflows" ON chatbot_workflows;
DROP POLICY IF EXISTS "Users can view their own conversation sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can create conversation sessions" ON conversation_sessions;

-- Other policies
DROP POLICY IF EXISTS "Allow access to payment structures" ON user_payment_structures;
DROP POLICY IF EXISTS "Users can view their own user API keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can manage their own user API keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can view their own credit cards" ON company_credit_cards;
DROP POLICY IF EXISTS "Users can manage their own credit cards" ON company_credit_cards;

-- 2. Create helper function for checking organization membership
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
  -- Get user's role in the organization
  SELECT role INTO user_role
  FROM organization_members
  WHERE organization_id = org_id
  AND organization_members.user_id = user_id
  AND status = 'active';
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the role has permission for this resource and action
  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = user_role
    AND role_permissions.resource = resource
    AND actions @> to_jsonb(action)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create new organization-based RLS policies

-- Users table (keep user-specific for profile management)
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Workflows
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

-- Executions
CREATE POLICY "Org members can view executions" ON executions
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can create executions" ON executions
  FOR INSERT WITH CHECK (
    is_org_member(organization_id) AND
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = executions.workflow_id 
      AND workflows.organization_id = executions.organization_id
    )
  );

-- Integrations
CREATE POLICY "Org members can view integrations" ON integrations
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage integrations" ON integrations
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'integrations', 'update')
  );

-- Bots
CREATE POLICY "Org members can view bots" ON bots
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage bots" ON bots
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'bots', 'update')
  );

-- Chatbot Workflows
CREATE POLICY "Org members can view chatbot workflows" ON chatbot_workflows
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage chatbot workflows" ON chatbot_workflows
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'workflows', 'update')
  );

-- Sales and Commission Tables
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

-- Commission Calculations - Sales users can only see their own
CREATE POLICY "View commission calculations" ON commission_calculations
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      -- Admins can see all
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      -- Sales users can see their own
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

-- Commission Payouts
CREATE POLICY "View commission payouts" ON commission_payouts
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      -- Admins can see all
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      -- Sales users can see their own
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

-- Contacts
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

-- Products
CREATE POLICY "Org members can view products" ON ghl_products
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage products" ON ghl_products
  FOR ALL USING (
    is_org_member(organization_id) AND
    can_access_resource(organization_id, 'sales', 'update')
  );

-- Conversation Sessions
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

-- API Keys (organization-level)
CREATE POLICY "Org members can view API keys" ON api_keys
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage API keys" ON api_keys
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- User API Keys (organization-level)
CREATE POLICY "Org members can view user API keys" ON user_api_keys
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Authorized users can manage user API keys" ON user_api_keys
  FOR ALL USING (
    is_org_member(organization_id) AND
    has_org_role(organization_id, ARRAY['owner', 'administrator'])
  );

-- Company Credit Cards
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

-- Time Entries
CREATE POLICY "View time entries" ON time_entries
  FOR SELECT USING (
    is_org_member(organization_id) AND (
      -- Admins can see all
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      -- Users can see their own
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
      -- Admins can manage all
      has_org_role(organization_id, ARRAY['owner', 'administrator']) OR
      -- Users can manage their own
      team_member_id IN (
        SELECT id FROM team_members 
        WHERE organization_id = time_entries.organization_id
        AND user_id = auth.uid()
      )
    )
  );

-- 4. Create policies for tables that might not have organization_id yet
-- These will use the user's default organization

-- Workflow Templates (global, read-only)
CREATE POLICY "All users can view workflow templates" ON workflow_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Pipeline Stages
CREATE POLICY "Org members can view pipeline stages" ON pipeline_stages
  FOR SELECT USING (
    organization_id IS NULL OR is_org_member(organization_id)
  );

CREATE POLICY "Authorized users can manage pipeline stages" ON pipeline_stages
  FOR ALL USING (
    organization_id IS NULL OR (
      is_org_member(organization_id) AND
      can_access_resource(organization_id, 'sales', 'update')
    )
  );

-- 5. Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_org_member TO authenticated;
GRANT EXECUTE ON FUNCTION has_org_role TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_resource TO authenticated;

-- 6. Add comments
COMMENT ON FUNCTION is_org_member IS 'Check if a user is an active member of an organization';
COMMENT ON FUNCTION has_org_role IS 'Check if a user has one of the specified roles in an organization';
COMMENT ON FUNCTION can_access_resource IS 'Check if a user has permission to perform an action on a resource';