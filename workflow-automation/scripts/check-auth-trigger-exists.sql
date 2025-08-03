-- Check if trigger exists
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgtype,
    tgenabled
FROM pg_trigger 
WHERE tgname IN ('on_auth_user_created', 'on_auth_user_updated')
    AND NOT tgisinternal;

-- Check if function exists
SELECT 
    proname as function_name,
    pronamespace::regnamespace as schema_name
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Check for users without organizations
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.created_at,
    om.organization_id
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
WHERE om.organization_id IS NULL
ORDER BY u.created_at DESC
LIMIT 10;