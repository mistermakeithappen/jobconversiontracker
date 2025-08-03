-- First, let's check if the tables exist
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
) as users_table_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations'
) as organizations_table_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'organization_members'
) as organization_members_table_exists;

-- Check if the trigger function exists
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
) as function_exists;

-- Check if triggers exist
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname LIKE '%auth_user%';

-- Test the function directly to see what error it produces
-- This will show us the exact error
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    error_msg TEXT;
    error_detail TEXT;
    error_hint TEXT;
BEGIN
    -- Try to execute the function logic manually
    BEGIN
        -- Insert test user
        INSERT INTO public.users (id, email, full_name)
        VALUES (test_user_id, 'manual_test@example.com', 'Manual Test');
        
        -- If successful, clean up
        DELETE FROM public.users WHERE id = test_user_id;
        
        RAISE NOTICE 'Manual user insert successful';
    EXCEPTION
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS 
                error_msg = MESSAGE_TEXT,
                error_detail = PG_EXCEPTION_DETAIL,
                error_hint = PG_EXCEPTION_HINT;
            RAISE NOTICE 'Error inserting user: %, Detail: %, Hint: %', error_msg, error_detail, error_hint;
    END;
END $$;