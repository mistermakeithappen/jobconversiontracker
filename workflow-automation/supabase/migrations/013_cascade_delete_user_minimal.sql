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