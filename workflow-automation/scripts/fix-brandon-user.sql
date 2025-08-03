-- Fix orphaned user for Brandon Burgan
-- Run this in Supabase SQL Editor

-- 1. Create user record
INSERT INTO users (id, email, full_name, created_at, updated_at)
VALUES (
  '4fe11a34-e95b-4cab-aa0f-12f14542568e',
  'burgan.brandon@gmail.com',
  'Brandon Burgan',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create organization
INSERT INTO organizations (name, slug, subscription_status, subscription_plan, created_by, created_at, updated_at)
VALUES (
  'Brandon Burgan Organization',
  'brandon-burgan-org',
  'trial',
  'free',
  '4fe11a34-e95b-4cab-aa0f-12f14542568e',
  NOW(),
  NOW()
) RETURNING id;

-- Note: Copy the organization ID from the above query result, then run the next queries

-- 3. Add user to organization as owner (replace 'YOUR_ORG_ID' with the actual ID from step 2)
-- Example: If step 2 returns id = '123e4567-e89b-12d3-a456-426614174000', use that
/*
INSERT INTO organization_members (
  organization_id, 
  user_id, 
  role, 
  custom_permissions, 
  status, 
  accepted_at,
  created_at,
  updated_at
)
VALUES (
  'YOUR_ORG_ID', -- Replace this with the actual org ID from step 2
  '4fe11a34-e95b-4cab-aa0f-12f14542568e',
  'owner',
  '{}'::jsonb,
  'active',
  NOW(),
  NOW(),
  NOW()
);

-- 4. Update organization user count
UPDATE organizations 
SET current_users = 1, updated_at = NOW()
WHERE id = 'YOUR_ORG_ID'; -- Replace with actual org ID
*/