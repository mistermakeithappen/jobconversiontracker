-- Fix user_payment_structures table to use VARCHAR for GoHighLevel user IDs
-- The current user_id field is UUID but we need to store GoHighLevel user IDs which are strings

-- First, drop any existing policies that depend on user_id column
DROP POLICY IF EXISTS "Users can manage their own payment structures" ON user_payment_structures;

-- Drop any existing foreign key constraints on user_id
-- (there shouldn't be any based on the original migration, but just in case)
DO $$
BEGIN
    -- Try to drop any foreign key constraints on user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%user_payment_structures_user_id%'
        AND table_name = 'user_payment_structures'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE user_payment_structures DROP CONSTRAINT IF EXISTS user_payment_structures_user_id_fkey;
    END IF;
END $$;

-- Change user_id from UUID to VARCHAR to store GoHighLevel user IDs
ALTER TABLE user_payment_structures 
ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;

-- Update the comment to reflect the change
COMMENT ON COLUMN user_payment_structures.user_id IS 'GoHighLevel user ID (string, not UUID)';

-- Recreate the index with the new data type
DROP INDEX IF EXISTS idx_user_payment_structures_user_id;
CREATE INDEX idx_user_payment_structures_user_id ON user_payment_structures(user_id);

-- Update the RLS policy comment
COMMENT ON POLICY "Allow access to payment structures" ON user_payment_structures IS 
'Allows access to payment structures - user_id now stores GoHighLevel user IDs as strings';