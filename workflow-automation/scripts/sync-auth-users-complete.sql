-- Complete Sync Auth Users to Users Table and Organizations SQL Script
-- This script handles the complete sync process for users who signed up before the trigger was created.

-- Step 1: Show current state
SELECT '=== CURRENT STATE ===' as info;
SELECT 
  'auth.users count' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'public.users count' as table_name,
  COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
  'organizations count' as table_name,
  COUNT(*) as count
FROM public.organizations
UNION ALL
SELECT 
  'organization_members count' as table_name,
  COUNT(*) as count
FROM public.organization_members;

-- Step 2: Show users that need to be synced
SELECT '=== USERS TO SYNC ===' as info;
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'full_name' as full_name_from_meta
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Step 3: Sync users to public.users table
SELECT '=== SYNCING USERS ===' as info;
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

-- Step 4: Show users without organizations
SELECT '=== USERS WITHOUT ORGANIZATIONS ===' as info;
SELECT 
  u.id,
  u.email,
  u.full_name,
  CASE WHEN om.organization_id IS NULL THEN 'NO ORG' ELSE 'HAS ORG' END as org_status
FROM public.users u
LEFT JOIN public.organization_members om ON u.id = om.user_id
WHERE om.organization_id IS NULL;

-- Step 5: Create organizations for users who don't have them
SELECT '=== CREATING ORGANIZATIONS ===' as info;

-- Create organizations for users without them
INSERT INTO public.organizations (id, name, slug, subscription_status, subscription_plan, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  COALESCE(
    u.raw_user_meta_data->>'organization_name',
    u.full_name || '''s Organization'
  ) as name,
  lower(regexp_replace(
    COALESCE(
      u.raw_user_meta_data->>'organization_name',
      u.full_name || 's Organization'
    ), 
    '[^a-z0-9]+', '-', 'g'
  )) as slug,
  'trial' as subscription_status,
  'free' as subscription_plan,
  u.id as created_by,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  SELECT 
    u.id,
    u.email,
    u.full_name,
    au.raw_user_meta_data
  FROM public.users u
  JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.organization_members om ON u.id = om.user_id
  WHERE om.organization_id IS NULL
) u
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Step 6: Add users as organization owners
SELECT '=== ADDING USERS AS ORGANIZATION OWNERS ===' as info;

INSERT INTO public.organization_members (id, organization_id, user_id, role, custom_permissions, status, invited_at, accepted_at, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  o.id as organization_id,
  u.id as user_id,
  'owner' as role,
  '{}'::jsonb as custom_permissions,
  'active' as status,
  NOW() as invited_at,
  NOW() as accepted_at,
  NOW() as created_at,
  NOW() as updated_at
FROM public.users u
JOIN public.organizations o ON o.created_by = u.id
LEFT JOIN public.organization_members om ON u.id = om.user_id
WHERE om.organization_id IS NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Step 7: Update organization user counts
SELECT '=== UPDATING ORGANIZATION USER COUNTS ===' as info;

UPDATE public.organizations 
SET current_users = (
  SELECT COUNT(*) 
  FROM public.organization_members 
  WHERE organization_id = organizations.id AND status = 'active'
)
WHERE id IN (
  SELECT DISTINCT organization_id 
  FROM public.organization_members 
  WHERE status = 'active'
);

-- Step 8: Show final state
SELECT '=== FINAL STATE ===' as info;
SELECT 
  'auth.users count' as table_name,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'public.users count' as table_name,
  COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
  'organizations count' as table_name,
  COUNT(*) as count
FROM public.organizations
UNION ALL
SELECT 
  'organization_members count' as table_name,
  COUNT(*) as count
FROM public.organization_members;

-- Step 9: Verify all users now have organizations
SELECT '=== VERIFICATION ===' as info;
SELECT 
  u.id,
  u.email,
  u.full_name,
  o.name as organization_name,
  om.role as user_role
FROM public.users u
JOIN public.organization_members om ON u.id = om.user_id
JOIN public.organizations o ON om.organization_id = o.id
ORDER BY u.created_at;

-- Step 10: Show any remaining issues
SELECT '=== REMAINING ISSUES ===' as info;
SELECT 
  u.id,
  u.email,
  u.full_name,
  CASE WHEN om.organization_id IS NULL THEN 'NO ORG' ELSE 'HAS ORG' END as org_status
FROM public.users u
LEFT JOIN public.organization_members om ON u.id = om.user_id
WHERE om.organization_id IS NULL;
