-- Production Database Permissions Fix
-- Run this in Supabase SQL Editor as the postgres user

-- First, ensure the uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant proper permissions to service_role
GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON FUNCTIONS TO service_role;

-- Ensure RLS is properly configured but doesn't block service_role
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Create policies that allow service_role full access
CREATE POLICY "Service role has full access to organizations" ON organizations
FOR ALL TO service_role
USING (true);

CREATE POLICY "Service role has full access to users" ON users
FOR ALL TO service_role
USING (true);

CREATE POLICY "Service role has full access to organization_members" ON organization_members
FOR ALL TO service_role
USING (true);