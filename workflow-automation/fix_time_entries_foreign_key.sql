-- Fix time_entries table foreign key constraint issue
-- Remove foreign key constraint to auth.users since we use mock auth

-- Drop the foreign key constraint
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

-- Also update the description field to be optional (allow NULL)
ALTER TABLE time_entries ALTER COLUMN description DROP NOT NULL;

-- Update comments
COMMENT ON COLUMN time_entries.user_id IS 'Mock user ID (not linked to auth.users due to mock auth system)';
COMMENT ON COLUMN time_entries.description IS 'Optional description of work performed';