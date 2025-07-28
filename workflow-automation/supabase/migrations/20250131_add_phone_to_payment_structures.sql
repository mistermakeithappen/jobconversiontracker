-- Add phone number field to user_payment_structures for SMS message routing
-- This allows the system to differentiate between internal messages from users and customer messages

ALTER TABLE user_payment_structures 
ADD COLUMN IF NOT EXISTS ghl_user_phone VARCHAR(20);

-- Update comments to reflect the new column
COMMENT ON COLUMN user_payment_structures.ghl_user_phone IS 'Phone number of the GoHighLevel user for SMS message routing';

-- Create index on phone number for SMS lookups
CREATE INDEX IF NOT EXISTS idx_user_payment_structures_phone ON user_payment_structures(ghl_user_phone);