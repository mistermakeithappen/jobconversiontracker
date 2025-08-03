-- Fix orphaned user for Brandon Burgan
-- Run this entire script in Supabase SQL Editor

DO $$
DECLARE
    org_id UUID;
BEGIN
    -- 1. Create user record if it doesn't exist
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
        'brandon-burgan-org-' || substr(gen_random_uuid()::text, 1, 8), -- Add random suffix to ensure uniqueness
        'trial',
        'free',
        '4fe11a34-e95b-4cab-aa0f-12f14542568e',
        NOW(),
        NOW()
    ) RETURNING id INTO org_id;

    -- 3. Add user to organization as owner
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
        org_id,
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
    WHERE id = org_id;

    RAISE NOTICE 'Successfully created organization with ID: %', org_id;
    RAISE NOTICE 'User Brandon Burgan has been fixed!';
END $$;

-- Verify the fix
SELECT 
    u.email,
    u.full_name,
    o.name as organization_name,
    om.role
FROM users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
WHERE u.id = '4fe11a34-e95b-4cab-aa0f-12f14542568e';