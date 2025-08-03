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