-- Create table for storing GoHighLevel user commission defaults
CREATE TABLE IF NOT EXISTS ghl_user_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  
  -- One-time sale commission settings
  commission_type VARCHAR(50) NOT NULL DEFAULT 'gross', -- 'gross', 'profit', 'tiered', 'flat'
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  
  -- Subscription/recurring commission settings
  subscription_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 5 CHECK (subscription_commission_percentage >= 0 AND subscription_commission_percentage <= 100),
  subscription_commission_type VARCHAR(50) NOT NULL DEFAULT 'first_payment_only', -- 'first_payment_only', 'all_payments', 'duration_based'
  subscription_duration_months INTEGER DEFAULT 12, -- For duration_based subscriptions
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique user per integration
  UNIQUE(integration_id, ghl_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_user_id ON ghl_user_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_integration_id ON ghl_user_commissions(integration_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_ghl_user_id ON ghl_user_commissions(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_user_commissions_active ON ghl_user_commissions(is_active) WHERE is_active = true;

-- Create updated_at trigger
CREATE TRIGGER update_ghl_user_commissions_updated_at 
    BEFORE UPDATE ON ghl_user_commissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE ghl_user_commissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mock auth
CREATE POLICY "Users can view their own GHL user commissions" ON ghl_user_commissions
    FOR SELECT USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

CREATE POLICY "Users can manage their own GHL user commissions" ON ghl_user_commissions
    FOR ALL USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

-- Add helpful comments
COMMENT ON TABLE ghl_user_commissions IS 'Default commission rates for GoHighLevel users including separate rates for subscriptions';
COMMENT ON COLUMN ghl_user_commissions.commission_percentage IS 'Default commission percentage for one-time sales';
COMMENT ON COLUMN ghl_user_commissions.subscription_commission_percentage IS 'Default commission percentage for subscription/recurring sales';
COMMENT ON COLUMN ghl_user_commissions.subscription_commission_type IS 'How subscription commissions are calculated: first_payment_only, all_payments, or duration_based';
COMMENT ON COLUMN ghl_user_commissions.subscription_duration_months IS 'Number of months to pay commission on subscriptions (for duration_based type)';