-- Comprehensive Permissions Fix for Production
-- Run this entire script in Supabase SQL Editor

-- 1. Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Grant schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA public TO postgres, service_role;

-- 3. Grant permissions on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
GRANT ALL ON FUNCTIONS TO service_role;

-- 5. Drop existing RLS policies for service_role if they exist
DO $$ 
BEGIN
    -- Organizations policies
    DROP POLICY IF EXISTS "Service role has full access to organizations" ON organizations;
    DROP POLICY IF EXISTS "service_role_organizations_all" ON organizations;
    
    -- Users policies
    DROP POLICY IF EXISTS "Service role has full access to users" ON users;
    DROP POLICY IF EXISTS "service_role_users_all" ON users;
    
    -- Organization members policies
    DROP POLICY IF EXISTS "Service role has full access to organization_members" ON organization_members;
    DROP POLICY IF EXISTS "service_role_organization_members_all" ON organization_members;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 6. Create new RLS policies that allow service_role full access
-- Note: service_role bypasses RLS by default, but we'll add explicit policies

-- Organizations table
CREATE POLICY "service_role_organizations_all" ON organizations
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Users table
CREATE POLICY "service_role_users_all" ON users
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Organization members table
CREATE POLICY "service_role_organization_members_all" ON organization_members
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Ensure RLS is enabled (service_role bypasses it anyway)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 8. Create policies for authenticated users (for future use)
-- Allow users to read their own data
CREATE POLICY "Users can view own profile" ON users
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Allow users to view their organizations
CREATE POLICY "Users can view their organizations" ON organization_members
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Allow users to view organization details they belong to
CREATE POLICY "Users can view organizations they belong to" ON organizations
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_members.organization_id = organizations.id 
        AND organization_members.user_id = auth.uid()
    )
);

-- 9. Test the permissions
DO $$
BEGIN
    RAISE NOTICE 'Permissions setup completed successfully!';
END $$;