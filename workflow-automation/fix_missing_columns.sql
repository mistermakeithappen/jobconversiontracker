-- Add missing columns to user_payment_structures table
-- Ensure all required columns exist for GHL user information

ALTER TABLE user_payment_structures 
ADD COLUMN IF NOT EXISTS ghl_user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS ghl_user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS ghl_user_phone VARCHAR(20);

-- Update comments to reflect the columns
COMMENT ON COLUMN user_payment_structures.ghl_user_name IS 'Full name of the GoHighLevel user';
COMMENT ON COLUMN user_payment_structures.ghl_user_email IS 'Email address of the GoHighLevel user';
COMMENT ON COLUMN user_payment_structures.ghl_user_phone IS 'Phone number of the GoHighLevel user for SMS message routing';

-- Create indexes for better lookups
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_ghl_email ON user_payment_structures(ghl_user_email);
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_phone ON user_payment_structures(ghl_user_phone);