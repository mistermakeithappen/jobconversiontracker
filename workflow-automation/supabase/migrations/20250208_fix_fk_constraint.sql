-- Fix foreign key constraint for development with mock auth
-- This removes the foreign key constraint to allow mock user IDs

-- Drop the foreign key constraint temporarily for development
DO $$
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_api_keys_user_id_fkey'
        AND table_name = 'user_api_keys'
    ) THEN
        ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_user_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint user_api_keys_user_id_fkey for development';
    ELSE
        RAISE NOTICE 'Foreign key constraint user_api_keys_user_id_fkey not found';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop foreign key constraint: %', SQLERRM;
END $$;

-- For production, you would want to re-add this constraint when using real Supabase auth:
-- ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;