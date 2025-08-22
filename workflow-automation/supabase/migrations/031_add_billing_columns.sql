-- =====================================================
-- 031_add_billing_columns.sql
-- Add missing billing and payment columns to users table
-- =====================================================

-- Add billing and payment columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS billing_address JSONB,
ADD COLUMN IF NOT EXISTS payment_method JSONB,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add constraint to ensure stripe_customer_id uniqueness if it exists
DO $$
BEGIN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_stripe_customer_id_unique'
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_stripe_customer_id_unique UNIQUE (stripe_customer_id);
    END IF;
END $$;

-- Update the customers table to properly link to users
-- (This ensures backward compatibility with existing data)
DO $$
BEGIN
    -- Add user_id column to customers if it doesn't exist
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE customers ADD COLUMN user_id UUID REFERENCES users(id);
    END IF;
    
    -- Create index for performance
    IF NOT EXISTS (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'customers' AND indexname = 'idx_customers_user_id'
    ) THEN
        CREATE INDEX idx_customers_user_id ON customers(user_id);
    END IF;
END $$;

-- Add RLS policy for users billing data
DO $$
BEGIN
    -- Enable RLS on users table if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policy for users to access their own billing data
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can access their own billing data'
    ) THEN
        CREATE POLICY "Users can access their own billing data"
          ON users FOR ALL USING (auth.uid() = id);
    END IF;
END $$;

-- Create a view for user billing summary (optional, for easier queries)
CREATE OR REPLACE VIEW user_billing_summary AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.billing_address,
  u.payment_method,
  u.stripe_customer_id,
  c.stripe_customer_id as customer_stripe_id,
  s.status as subscription_status,
  s.current_period_end
FROM users u
LEFT JOIN customers c ON u.id = c.user_id OR u.stripe_customer_id = c.stripe_customer_id
LEFT JOIN subscriptions s ON c.stripe_customer_id = s.customer_id
WHERE s.status IN ('active', 'trialing') OR s.status IS NULL;

-- Grant access to the view
GRANT SELECT ON user_billing_summary TO authenticated;
