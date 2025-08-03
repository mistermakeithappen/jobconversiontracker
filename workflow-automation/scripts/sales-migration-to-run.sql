-- Create sales tracking and commission system tables
-- This migration adds comprehensive sales tracking, product sync, and commission calculation capabilities

-- First, ensure we have the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create GHL Products table for syncing products from GoHighLevel
CREATE TABLE IF NOT EXISTS ghl_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_product_id VARCHAR NOT NULL,
  
  -- Product details
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  price_type VARCHAR(50) CHECK (price_type IN ('one_time', 'recurring')),
  recurring_interval VARCHAR(50) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly', NULL)),
  recurring_interval_count INTEGER DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique products per integration
  UNIQUE(integration_id, ghl_product_id)
);

-- 2. Create Sales Transactions table for tracking all sales
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL References
  opportunity_id VARCHAR NOT NULL,
  contact_id VARCHAR NOT NULL,
  product_id UUID REFERENCES ghl_products(id),
  ghl_invoice_id VARCHAR,
  ghl_payment_id VARCHAR,
  ghl_transaction_id VARCHAR,
  
  -- Transaction details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_method VARCHAR(50), -- 'credit_card', 'ach', 'cash', 'check', etc
  payment_status VARCHAR(50) NOT NULL CHECK (payment_status IN ('completed', 'pending', 'failed', 'refunded', 'partially_refunded')),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('sale', 'subscription_initial', 'subscription_renewal', 'refund', 'partial_refund')),
  
  -- Subscription tracking
  subscription_id VARCHAR,
  subscription_period_start DATE,
  subscription_period_end DATE,
  is_first_payment BOOLEAN DEFAULT false,
  
  -- Additional data
  raw_webhook_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate webhook processing
  UNIQUE(integration_id, ghl_payment_id)
);

-- 3. Create Commission Calculations table
CREATE TABLE IF NOT EXISTS commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  
  -- Commission details
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('gross', 'profit', 'hybrid', 'tiered', 'flat')),
  commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  commission_tier VARCHAR(50), -- For tiered commissions
  base_amount DECIMAL(10,2) NOT NULL, -- Amount commission is calculated on
  commission_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Profit calculation fields (for profit-based commissions)
  revenue_amount DECIMAL(10,2),
  expense_amount DECIMAL(10,2),
  profit_amount DECIMAL(10,2),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled', 'on_hold')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- For subscription commissions
  requires_payment_verification BOOLEAN DEFAULT false,
  verification_status VARCHAR(50) CHECK (verification_status IN ('pending', 'verified', 'failed', NULL)),
  verification_date TIMESTAMP WITH TIME ZONE,
  next_verification_date DATE, -- For recurring subscription verification
  
  -- Payout reference
  payout_id UUID, -- Will reference commission_payouts when paid
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Commission Payouts table
CREATE TABLE IF NOT EXISTS commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  
  -- Payout details
  payout_number VARCHAR UNIQUE, -- e.g., 'PAY-2025-001'
  payout_date DATE NOT NULL,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment information
  payment_method VARCHAR(50) CHECK (payment_method IN ('direct_deposit', 'check', 'paypal', 'wire', 'other')),
  payment_reference VARCHAR, -- Check number, transfer ID, etc
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Summary stats
  commission_count INTEGER DEFAULT 0,
  total_sales_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Administrative
  generated_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Payout Line Items table
CREATE TABLE IF NOT EXISTS payout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES commission_calculations(id),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id),
  
  -- Line item details
  opportunity_id VARCHAR NOT NULL,
  opportunity_name VARCHAR,
  contact_id VARCHAR NOT NULL,
  contact_name VARCHAR,
  product_name VARCHAR,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2),
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Additional context
  transaction_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ghl_products_user_id ON ghl_products(user_id);
CREATE INDEX idx_ghl_products_integration_id ON ghl_products(integration_id);
CREATE INDEX idx_ghl_products_ghl_product_id ON ghl_products(ghl_product_id);
CREATE INDEX idx_ghl_products_active ON ghl_products(is_active) WHERE is_active = true;

CREATE INDEX idx_sales_transactions_user_id ON sales_transactions(user_id);
CREATE INDEX idx_sales_transactions_integration_id ON sales_transactions(integration_id);
CREATE INDEX idx_sales_transactions_opportunity_id ON sales_transactions(opportunity_id);
CREATE INDEX idx_sales_transactions_contact_id ON sales_transactions(contact_id);
CREATE INDEX idx_sales_transactions_product_id ON sales_transactions(product_id);
CREATE INDEX idx_sales_transactions_payment_date ON sales_transactions(payment_date);
CREATE INDEX idx_sales_transactions_payment_status ON sales_transactions(payment_status);
CREATE INDEX idx_sales_transactions_subscription_id ON sales_transactions(subscription_id) WHERE subscription_id IS NOT NULL;

CREATE INDEX idx_commission_calculations_user_id ON commission_calculations(user_id);
CREATE INDEX idx_commission_calculations_transaction_id ON commission_calculations(transaction_id);
CREATE INDEX idx_commission_calculations_ghl_user_id ON commission_calculations(ghl_user_id);
CREATE INDEX idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX idx_commission_calculations_payout_id ON commission_calculations(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX idx_commission_calculations_verification ON commission_calculations(requires_payment_verification, verification_status) 
  WHERE requires_payment_verification = true;

CREATE INDEX idx_commission_payouts_user_id ON commission_payouts(user_id);
CREATE INDEX idx_commission_payouts_ghl_user_id ON commission_payouts(ghl_user_id);
CREATE INDEX idx_commission_payouts_payout_number ON commission_payouts(payout_number);
CREATE INDEX idx_commission_payouts_payment_status ON commission_payouts(payment_status);
CREATE INDEX idx_commission_payouts_payout_date ON commission_payouts(payout_date);

CREATE INDEX idx_payout_line_items_payout_id ON payout_line_items(payout_id);
CREATE INDEX idx_payout_line_items_commission_id ON payout_line_items(commission_id);
CREATE INDEX idx_payout_line_items_opportunity_id ON payout_line_items(opportunity_id);

-- Create updated_at triggers
CREATE TRIGGER update_ghl_products_updated_at 
  BEFORE UPDATE ON ghl_products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_transactions_updated_at 
  BEFORE UPDATE ON sales_transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_calculations_updated_at 
  BEFORE UPDATE ON commission_calculations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_payouts_updated_at 
  BEFORE UPDATE ON commission_payouts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE ghl_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- GHL Products policies
CREATE POLICY "Users can view their own products" ON ghl_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own products" ON ghl_products
  FOR ALL USING (auth.uid() = user_id);

-- Sales Transactions policies
CREATE POLICY "Users can view their own transactions" ON sales_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions" ON sales_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Commission Calculations policies
CREATE POLICY "Users can view their own calculations" ON commission_calculations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own calculations" ON commission_calculations
  FOR ALL USING (auth.uid() = user_id);

-- Commission Payouts policies
CREATE POLICY "Users can view their own payouts" ON commission_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own payouts" ON commission_payouts
  FOR ALL USING (auth.uid() = user_id);

-- Payout Line Items policies
CREATE POLICY "Users can view their own payout items" ON payout_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_payouts 
      WHERE commission_payouts.id = payout_line_items.payout_id 
      AND commission_payouts.user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE ghl_products IS 'Stores products synced from GoHighLevel for sales tracking';
COMMENT ON TABLE sales_transactions IS 'Records all sales transactions and payments from GoHighLevel';
COMMENT ON TABLE commission_calculations IS 'Tracks commission calculations for each sale with approval workflow';
COMMENT ON TABLE commission_payouts IS 'Manages commission payout batches for sales team members';
COMMENT ON TABLE payout_line_items IS 'Details individual commission items within each payout';

COMMENT ON COLUMN sales_transactions.transaction_type IS 'Type of transaction: sale, subscription_initial, subscription_renewal, refund, partial_refund';
COMMENT ON COLUMN commission_calculations.requires_payment_verification IS 'For subscriptions, requires verification of renewal payment before releasing commission';
COMMENT ON COLUMN commission_calculations.commission_type IS 'Commission calculation method: gross (% of sale), profit (% of profit), hybrid, tiered, or flat amount';
COMMENT ON COLUMN commission_payouts.payout_number IS 'Unique payout identifier for tracking, e.g. PAY-2025-001';

-- Create a function to generate payout numbers
CREATE OR REPLACE FUNCTION generate_payout_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the last payout number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(payout_number FROM 'PAY-\d{4}-(\d{3})') AS INTEGER)), 0)
  INTO last_number
  FROM commission_payouts
  WHERE payout_number LIKE 'PAY-' || current_year || '-%';
  
  -- Generate new number
  new_number := 'PAY-' || current_year || '-' || LPAD((last_number + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate commission based on transaction
CREATE OR REPLACE FUNCTION calculate_commission_amount(
  p_transaction_id UUID,
  p_commission_type VARCHAR,
  p_commission_percentage DECIMAL
)
RETURNS TABLE (
  base_amount DECIMAL,
  commission_amount DECIMAL
) AS $$
DECLARE
  v_transaction RECORD;
  v_base_amount DECIMAL;
  v_commission_amount DECIMAL;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM sales_transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- Calculate base amount based on commission type
  CASE p_commission_type
    WHEN 'gross' THEN
      v_base_amount := v_transaction.amount;
    WHEN 'profit' THEN
      -- For profit-based, we'll need to get expenses from opportunity_receipts
      -- This is a simplified version - you may want to enhance this
      SELECT 
        v_transaction.amount - COALESCE(SUM(or.amount), 0)
      INTO v_base_amount
      FROM opportunity_receipts or
      WHERE or.opportunity_id = v_transaction.opportunity_id;
    ELSE
      v_base_amount := v_transaction.amount;
  END CASE;
  
  -- Calculate commission
  v_commission_amount := v_base_amount * (p_commission_percentage / 100);
  
  RETURN QUERY SELECT v_base_amount, v_commission_amount;
END;
$$ LANGUAGE plpgsql;

-- Create a view for commission dashboard
CREATE OR REPLACE VIEW commission_dashboard AS
SELECT 
  cc.id,
  cc.user_id,
  cc.ghl_user_id,
  cc.opportunity_id,
  cc.commission_type,
  cc.commission_percentage,
  cc.commission_amount,
  cc.status,
  cc.created_at,
  st.amount as sale_amount,
  st.payment_date,
  st.transaction_type,
  st.contact_id,
  gp.name as product_name,
  cp.payout_number,
  cp.payment_status as payout_status
FROM commission_calculations cc
JOIN sales_transactions st ON cc.transaction_id = st.id
LEFT JOIN ghl_products gp ON st.product_id = gp.id
LEFT JOIN commission_payouts cp ON cc.payout_id = cp.id;

-- Grant access to the view
GRANT SELECT ON commission_dashboard TO authenticated;