-- Manual user deletion script
-- Replace 'USER_EMAIL' with the actual email of the user to delete

-- Set the email of the user to delete
DO $$
DECLARE
  user_email TEXT := 'USER_EMAIL'; -- CHANGE THIS
  user_id UUID;
  org_ids UUID[];
BEGIN
  -- Get user ID
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', user_email;
    
    -- Try to find in public.users
    SELECT id INTO user_id
    FROM public.users
    WHERE email = user_email;
    
    IF user_id IS NULL THEN
      RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
  END IF;
  
  RAISE NOTICE 'Found user with ID: %', user_id;
  
  -- Get organizations where user is the only owner
  SELECT ARRAY_AGG(DISTINCT om.organization_id) INTO org_ids
  FROM organization_members om
  WHERE om.user_id = user_id
  AND om.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.organization_id = om.organization_id
    AND om2.user_id != user_id
    AND om2.role = 'owner'
  );
  
  IF org_ids IS NOT NULL THEN
    RAISE NOTICE 'User is sole owner of % organization(s)', array_length(org_ids, 1);
    
    -- Delete organizations (cascades will handle related data)
    DELETE FROM organizations WHERE id = ANY(org_ids);
    RAISE NOTICE 'Deleted organizations';
  END IF;
  
  -- Remove user from organizations where they're not the sole owner
  DELETE FROM organization_members WHERE user_id = user_id;
  RAISE NOTICE 'Removed user from all organizations';
  
  -- Delete from public.users (cascades will handle related data)
  DELETE FROM public.users WHERE id = user_id;
  RAISE NOTICE 'Deleted user from public.users';
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = user_id;
  RAISE NOTICE 'Deleted user from auth.users';
  
  RAISE NOTICE 'Successfully deleted user % and all related data', user_email;
END $$;

-- Verify deletion
SELECT 
  'auth.users' as table_name,
  COUNT(*) as count
FROM auth.users
WHERE email = 'USER_EMAIL'
UNION ALL
SELECT 
  'public.users' as table_name,
  COUNT(*) as count
FROM public.users
WHERE email = 'USER_EMAIL';