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