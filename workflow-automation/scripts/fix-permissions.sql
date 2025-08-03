-- Fix permissions for public schema
-- Run this in Supabase SQL Editor as postgres user

-- Grant usage on public schema to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant all privileges on all tables in public schema to anon and authenticated
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Grant all privileges on all sequences in public schema to anon and authenticated
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Grant all privileges on all functions in public schema to anon and authenticated
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Ensure service_role has all permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Specifically grant permissions on the tables we need
GRANT ALL ON organizations TO service_role;
GRANT ALL ON users TO service_role;
GRANT ALL ON organization_members TO service_role;