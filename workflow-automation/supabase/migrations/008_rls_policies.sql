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