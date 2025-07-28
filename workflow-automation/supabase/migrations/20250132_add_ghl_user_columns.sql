-- Add GHL user information to user_payment_structures table
-- This allows us to store GoHighLevel user info directly in the payment structure

ALTER TABLE user_payment_structures 
ADD COLUMN IF NOT EXISTS ghl_user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS ghl_user_email VARCHAR(255);

-- Update comments to reflect the new columns
COMMENT ON COLUMN user_payment_structures.user_id IS 'GoHighLevel user ID (acts as external user reference)';
COMMENT ON COLUMN user_payment_structures.ghl_user_name IS 'Full name of the GoHighLevel user';
COMMENT ON COLUMN user_payment_structures.ghl_user_email IS 'Email address of the GoHighLevel user';

-- Create index on GHL user info for better lookups
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_ghl_email ON user_payment_structures(ghl_user_email);

-- Update the RLS policy to be more flexible for admin access
DROP POLICY IF EXISTS "Users can manage their own payment structures" ON user_payment_structures;

-- Create new policy that allows access to payment structures
-- In a real app, you'd want more sophisticated access control
CREATE POLICY "Allow access to payment structures" ON user_payment_structures
  FOR ALL USING (true); -- For now, allow all access - you can restrict this based on your auth system