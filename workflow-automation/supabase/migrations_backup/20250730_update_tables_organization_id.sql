-- Update existing tables to support multi-tenancy with organization_id
-- This migration adds organization_id to all tables and updates foreign keys

-- 1. Add organization_id to core tables
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE workflow_versions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. Add organization_id to GHL-related tables
ALTER TABLE opportunity_receipts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE contact_sync_logs ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 3. Add organization_id and team_member_id to commission/sales tables
ALTER TABLE user_payment_structures ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE user_payment_structures ADD COLUMN IF NOT EXISTS team_member_id UUID;
ALTER TABLE user_payment_assignments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE user_payment_assignments ADD COLUMN IF NOT EXISTS team_member_id UUID;

ALTER TABLE opportunity_commissions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE opportunity_commissions ADD COLUMN IF NOT EXISTS team_member_id UUID;

ALTER TABLE ghl_products ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS team_member_id UUID;

ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS team_member_id UUID;

ALTER TABLE commission_payouts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE commission_payouts ADD COLUMN IF NOT EXISTS team_member_id UUID;

ALTER TABLE ghl_user_commissions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE ghl_user_commissions ADD COLUMN IF NOT EXISTS team_member_id UUID;

-- 4. Add organization_id to bot/chatbot tables
ALTER TABLE bots ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE chatbot_workflows ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE conversation_sessions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE workflow_checkpoints ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 5. Add organization_id to other tables
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE company_credit_cards ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE pipeline_stage_analysis ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 6. Create temporary function to get organization_id from user_id
CREATE OR REPLACE FUNCTION temp_get_org_id_from_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- For migration, create a default organization for each user
  SELECT id INTO v_org_id
  FROM organizations
  WHERE created_by = p_user_id
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    -- Create organization for this user
    INSERT INTO organizations (
      name,
      slug,
      created_by,
      subscription_status,
      subscription_plan
    ) VALUES (
      'Organization for User ' || p_user_id::text,
      'org-' || p_user_id::text,
      p_user_id,
      'active',
      'professional'
    )
    RETURNING id INTO v_org_id;
    
    -- Add user as owner
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      status,
      accepted_at
    ) VALUES (
      v_org_id,
      p_user_id,
      'owner',
      'active',
      NOW()
    );
  END IF;
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Update all tables with organization_id based on user_id
UPDATE workflows SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE workflow_versions SET organization_id = (SELECT organization_id FROM workflows WHERE workflows.id = workflow_versions.workflow_id) WHERE organization_id IS NULL;
UPDATE executions SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE api_keys SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE integrations SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;

UPDATE opportunity_receipts SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE time_entries SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE contacts SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE contact_sync_logs SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;

UPDATE user_payment_structures SET organization_id = (SELECT organization_id FROM integrations WHERE integrations.user_id = user_payment_structures.created_by LIMIT 1) WHERE organization_id IS NULL;
UPDATE user_payment_assignments SET organization_id = (SELECT organization_id FROM integrations WHERE integrations.user_id = user_payment_assignments.created_by LIMIT 1) WHERE organization_id IS NULL;

UPDATE opportunity_commissions SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE ghl_products SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE sales_transactions SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE commission_calculations SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE commission_payouts SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE ghl_user_commissions SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;

UPDATE bots SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE chatbot_workflows SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE conversation_sessions SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE workflow_checkpoints SET organization_id = (SELECT organization_id FROM chatbot_workflows WHERE chatbot_workflows.id = workflow_checkpoints.workflow_id) WHERE organization_id IS NULL;
UPDATE workflow_nodes SET organization_id = (SELECT organization_id FROM chatbot_workflows WHERE chatbot_workflows.id = workflow_nodes.workflow_id) WHERE organization_id IS NULL;

UPDATE user_api_keys SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE company_credit_cards SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE pipeline_stages SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;
UPDATE pipeline_stage_analysis SET organization_id = temp_get_org_id_from_user(user_id) WHERE organization_id IS NULL;

-- 8. Create function to migrate GHL users to team_members
CREATE OR REPLACE FUNCTION migrate_ghl_users_to_team_members()
RETURNS void AS $$
DECLARE
  r RECORD;
  v_team_member_id UUID;
BEGIN
  -- Migrate from user_payment_structures
  FOR r IN 
    SELECT DISTINCT 
      ups.user_id as ghl_user_id,
      ups.ghl_user_name,
      ups.ghl_user_email,
      ups.phone,
      ups.organization_id
    FROM user_payment_structures ups
    WHERE ups.ghl_user_email IS NOT NULL
  LOOP
    -- Check if team member already exists
    SELECT id INTO v_team_member_id
    FROM team_members
    WHERE organization_id = r.organization_id
    AND (external_id = r.ghl_user_id OR email = r.ghl_user_email);
    
    IF v_team_member_id IS NULL THEN
      INSERT INTO team_members (
        organization_id,
        external_id,
        email,
        full_name,
        phone,
        member_type,
        commission_rate,
        commission_type
      ) VALUES (
        r.organization_id,
        r.ghl_user_id,
        r.ghl_user_email,
        COALESCE(r.ghl_user_name, 'Unknown'),
        r.phone,
        'sales',
        10.00, -- Default commission rate
        'gross'
      )
      RETURNING id INTO v_team_member_id;
    END IF;
    
    -- Update the payment structure with team_member_id
    UPDATE user_payment_structures 
    SET team_member_id = v_team_member_id
    WHERE user_id = r.ghl_user_id;
  END LOOP;
  
  -- Migrate from ghl_user_commissions
  FOR r IN 
    SELECT DISTINCT 
      guc.ghl_user_id,
      guc.ghl_user_name,
      guc.ghl_user_email,
      guc.organization_id,
      guc.commission_rate,
      guc.commission_type
    FROM ghl_user_commissions guc
    WHERE guc.organization_id IS NOT NULL
  LOOP
    -- Check if team member already exists
    SELECT id INTO v_team_member_id
    FROM team_members
    WHERE organization_id = r.organization_id
    AND (external_id = r.ghl_user_id OR email = r.ghl_user_email);
    
    IF v_team_member_id IS NULL THEN
      INSERT INTO team_members (
        organization_id,
        external_id,
        email,
        full_name,
        member_type,
        commission_rate,
        commission_type
      ) VALUES (
        r.organization_id,
        r.ghl_user_id,
        r.ghl_user_email,
        COALESCE(r.ghl_user_name, 'Unknown'),
        'sales',
        COALESCE(r.commission_rate, 10.00),
        COALESCE(r.commission_type, 'gross')
      )
      RETURNING id INTO v_team_member_id;
    ELSE
      -- Update commission info if better data available
      UPDATE team_members
      SET 
        commission_rate = COALESCE(r.commission_rate, commission_rate),
        commission_type = COALESCE(r.commission_type, commission_type)
      WHERE id = v_team_member_id;
    END IF;
    
    -- Update the ghl_user_commissions with team_member_id
    UPDATE ghl_user_commissions 
    SET team_member_id = v_team_member_id
    WHERE ghl_user_id = r.ghl_user_id
    AND organization_id = r.organization_id;
  END LOOP;
  
  -- Update other tables with team_member_id based on ghl_user_id
  UPDATE opportunity_commissions oc
  SET team_member_id = tm.id
  FROM team_members tm
  WHERE oc.organization_id = tm.organization_id
  AND oc.ghl_user_id = tm.external_id
  AND oc.team_member_id IS NULL;
  
  UPDATE time_entries te
  SET team_member_id = tm.id
  FROM team_members tm
  WHERE te.organization_id = tm.organization_id
  AND te.ghl_user_id = tm.external_id;
  
  UPDATE commission_calculations cc
  SET team_member_id = tm.id
  FROM team_members tm
  WHERE cc.organization_id = tm.organization_id
  AND cc.ghl_user_id = tm.external_id
  AND cc.team_member_id IS NULL;
  
  UPDATE commission_payouts cp
  SET team_member_id = tm.id
  FROM team_members tm
  WHERE cp.organization_id = tm.organization_id
  AND cp.ghl_user_id = tm.external_id
  AND cp.team_member_id IS NULL;
  
  UPDATE user_payment_assignments upa
  SET team_member_id = tm.id
  FROM team_members tm
  WHERE upa.organization_id = tm.organization_id
  AND upa.ghl_user_id = tm.external_id
  AND upa.team_member_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_ghl_users_to_team_members();

-- 9. Add NOT NULL constraints after migration
ALTER TABLE workflows ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE integrations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE bots ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE chatbot_workflows ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE opportunity_receipts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ghl_products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sales_transactions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE commission_calculations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE commission_payouts ALTER COLUMN organization_id SET NOT NULL;

-- 10. Add foreign key constraints
ALTER TABLE workflows ADD CONSTRAINT fk_workflows_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE integrations ADD CONSTRAINT fk_integrations_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE bots ADD CONSTRAINT fk_bots_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE chatbot_workflows ADD CONSTRAINT fk_chatbot_workflows_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE opportunity_receipts ADD CONSTRAINT fk_opportunity_receipts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE contacts ADD CONSTRAINT fk_contacts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE ghl_products ADD CONSTRAINT fk_ghl_products_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE sales_transactions ADD CONSTRAINT fk_sales_transactions_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE commission_calculations ADD CONSTRAINT fk_commission_calculations_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE commission_payouts ADD CONSTRAINT fk_commission_payouts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Add team_member foreign keys
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id);
ALTER TABLE opportunity_commissions ADD CONSTRAINT fk_opportunity_commissions_team_member 
  FOREIGN KEY (team_member_id) REFERENCES team_members(id);

ALTER TABLE commission_calculations ADD CONSTRAINT fk_commission_calculations_team_member 
  FOREIGN KEY (team_member_id) REFERENCES team_members(id);

ALTER TABLE commission_payouts ADD CONSTRAINT fk_commission_payouts_team_member 
  FOREIGN KEY (team_member_id) REFERENCES team_members(id);

-- 11. Create new indexes for organization_id
CREATE INDEX idx_workflows_organization ON workflows(organization_id);
CREATE INDEX idx_integrations_organization ON integrations(organization_id);
CREATE INDEX idx_bots_organization ON bots(organization_id);
CREATE INDEX idx_chatbot_workflows_organization ON chatbot_workflows(organization_id);
CREATE INDEX idx_opportunity_receipts_organization ON opportunity_receipts(organization_id);
CREATE INDEX idx_contacts_organization ON contacts(organization_id);
CREATE INDEX idx_ghl_products_organization ON ghl_products(organization_id);
CREATE INDEX idx_sales_transactions_organization ON sales_transactions(organization_id);
CREATE INDEX idx_commission_calculations_organization ON commission_calculations(organization_id);
CREATE INDEX idx_commission_payouts_organization ON commission_payouts(organization_id);

-- 12. Drop temporary function
DROP FUNCTION IF EXISTS temp_get_org_id_from_user(UUID);

-- 13. Create view for easy access to user's organization
CREATE OR REPLACE VIEW user_organization_view AS
SELECT 
  om.user_id,
  om.organization_id,
  om.role,
  o.name as organization_name,
  o.slug as organization_slug,
  o.subscription_status,
  o.subscription_plan
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.status = 'active';

GRANT SELECT ON user_organization_view TO authenticated;

COMMENT ON VIEW user_organization_view IS 'Quick access to user organization information';