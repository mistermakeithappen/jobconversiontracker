-- First, find your auth user by email
-- Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
  auth_user_id UUID;
  auth_user_email TEXT;
  org_id UUID;
  user_full_name TEXT;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- CHANGE THIS TO YOUR EMAIL
  auth_user_email := 'brandon@conversionmarketingpros.com';
  
  -- Find the auth user
  SELECT id, raw_user_meta_data->>'full_name'
  INTO auth_user_id, user_full_name
  FROM auth.users
  WHERE email = auth_user_email
  LIMIT 1;
  
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email: %', auth_user_email;
  END IF;
  
  RAISE NOTICE 'Found auth user: % with email: %', auth_user_id, auth_user_email;
  
  -- Use email prefix as name if full_name not available
  IF user_full_name IS NULL THEN
    user_full_name := split_part(auth_user_email, '@', 1);
  END IF;
  
  -- Create or update user record in public.users
  INSERT INTO public.users (id, email, full_name)
  VALUES (auth_user_id, auth_user_email, user_full_name)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  
  RAISE NOTICE 'Created/updated user record in public.users';
  
  -- Check if user already has an organization
  SELECT om.organization_id 
  INTO org_id
  FROM organization_members om
  WHERE om.user_id = auth_user_id
  LIMIT 1;
  
  IF org_id IS NOT NULL THEN
    RAISE NOTICE 'User already has organization: %', org_id;
    RETURN;
  END IF;
  
  -- Create organization
  org_name := user_full_name || '''s Organization';
  org_slug := lower(regexp_replace(user_full_name || '-organization', '[^a-z0-9]+', '-', 'g'));
  org_slug := regexp_replace(org_slug, '^-+|-+$', '', 'g');
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END LOOP;
  
  INSERT INTO organizations (
    name,
    slug,
    subscription_status,
    subscription_plan,
    created_by,
    current_users
  )
  VALUES (
    org_name,
    org_slug,
    'trial',
    'free',
    auth_user_id,
    1
  )
  RETURNING id INTO org_id;
  
  RAISE NOTICE 'Created organization: % with name: %', org_id, org_name;
  
  -- Add user as owner
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    custom_permissions,
    status,
    accepted_at
  )
  VALUES (
    org_id,
    auth_user_id,
    'owner',
    '{}'::jsonb,
    'active',
    NOW()
  );
  
  RAISE NOTICE 'Added user as owner of organization';
  RAISE NOTICE 'SUCCESS! User % can now log in.', auth_user_email;
END $$;