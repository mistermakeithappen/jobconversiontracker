-- Sync Auth Users to Users Table SQL Script
-- This script syncs all existing users from Supabase Auth (auth.users) 
-- to the public.users table for users who signed up before the trigger was created.

-- First, let's see what we're working with
SELECT 
  'auth.users count' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'public.users count' as table_name,
  COUNT(*) as count
FROM public.users;

-- Show users that exist in auth but not in public.users
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Insert missing users into public.users table
INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    INITCAP(REPLACE(REPLACE(REPLACE(SPLIT_PART(au.email, '@', 1), '.', ' '), '_', ' '), '-', ' '))
  ) as full_name,
  au.raw_user_meta_data->>'avatar_url' as avatar_url,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- Show the results after sync
SELECT 
  'After sync - auth.users count' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'After sync - public.users count' as table_name,
  COUNT(*) as count
FROM public.users;

-- Check for users without organizations
SELECT 
  u.id,
  u.email,
  u.full_name,
  CASE WHEN om.organization_id IS NULL THEN 'NO ORG' ELSE 'HAS ORG' END as org_status
FROM public.users u
LEFT JOIN public.organization_members om ON u.id = om.user_id
WHERE om.organization_id IS NULL;

-- Create organizations for users who don't have them
-- This is a more complex operation that should be done carefully
-- You may want to run this manually after reviewing the results above

-- Example of creating an organization for a specific user:
-- INSERT INTO public.organizations (name, slug, subscription_status, subscription_plan, created_by)
-- VALUES ('User Organization', 'user-organization', 'trial', 'free', 'USER_ID_HERE')
-- ON CONFLICT DO NOTHING;

-- Then add the user as a member:
-- INSERT INTO public.organization_members (organization_id, user_id, role, status, accepted_at)
-- VALUES ('ORG_ID_HERE', 'USER_ID_HERE', 'owner', 'active', NOW())
-- ON CONFLICT DO NOTHING;
