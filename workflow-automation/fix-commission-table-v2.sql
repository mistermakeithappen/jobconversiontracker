-- Fix the opportunity_commissions table to work with mock auth
-- Step 1: Drop all policies first
DROP POLICY IF EXISTS "Users can view their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can insert their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can update their own opportunity commissions" ON opportunity_commissions;
DROP POLICY IF EXISTS "Users can delete their own opportunity commissions" ON opportunity_commissions;

-- Step 2: Drop the foreign key constraint
ALTER TABLE opportunity_commissions 
DROP CONSTRAINT IF EXISTS opportunity_commissions_user_id_fkey;

-- Step 3: Change user_id to VARCHAR
ALTER TABLE opportunity_commissions 
ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text;

-- Step 4: Create new policy that allows access (since we're using mock auth)
CREATE POLICY "Allow all access to opportunity commissions" ON opportunity_commissions
    FOR ALL USING (true);

-- Step 5: Add comment explaining the change
COMMENT ON COLUMN opportunity_commissions.user_id IS 'Mock auth user ID (VARCHAR, not UUID reference to auth.users)';