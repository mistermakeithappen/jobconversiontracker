-- Fix the opportunity_commissions table to work with mock auth
-- Remove the foreign key constraint that references auth.users

-- Drop the foreign key constraint
ALTER TABLE opportunity_commissions 
DROP CONSTRAINT IF EXISTS opportunity_commissions_user_id_fkey;

-- Change user_id to VARCHAR to match our mock auth system
ALTER TABLE opportunity_commissions 
ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;

-- Update the RLS policies to work without auth.uid()
DROP POLICY IF EXISTS "Users can view their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can insert their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can update their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can delete their own opportunity commissions" ON opportunity_commissions;

-- Create new policies that allow access (since we're using mock auth)
CREATE POLICY "Allow all access to opportunity commissions" ON opportunity_commissions
    FOR ALL USING (true);

-- Add comment explaining the change
COMMENT ON COLUMN opportunity_commissions.user_id IS 'Mock auth user ID (VARCHAR, not UUID reference to auth.users)';