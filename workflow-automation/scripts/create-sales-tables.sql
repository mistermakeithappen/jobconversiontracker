-- Create Sales Transactions table for tracking all sales
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
  payment_method VARCHAR(50),
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

-- Create Commission Calculations table
CREATE TABLE IF NOT EXISTS commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  
  -- Commission details
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('gross', 'profit', 'hybrid', 'tiered', 'flat')),
  commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  commission_tier VARCHAR(50),
  base_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Profit calculation fields
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
  next_verification_date DATE,
  
  -- Payout reference
  payout_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Commission Payouts table
CREATE TABLE IF NOT EXISTS commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  
  -- Payout details
  payout_number VARCHAR UNIQUE,
  payout_date DATE NOT NULL,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment information
  payment_method VARCHAR(50) CHECK (payment_method IN ('direct_deposit', 'check', 'paypal', 'wire', 'other')),
  payment_reference VARCHAR,
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

-- Create Payout Line Items table
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

-- Enable Row Level Security
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sales_transactions
CREATE POLICY "Users can view their own transactions" ON sales_transactions
  FOR SELECT USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

CREATE POLICY "Users can manage their own transactions" ON sales_transactions
  FOR ALL USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

-- Create RLS policies for commission_calculations
CREATE POLICY "Users can view their own calculations" ON commission_calculations
  FOR SELECT USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

CREATE POLICY "Users can manage their own calculations" ON commission_calculations
  FOR ALL USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

-- Create RLS policies for commission_payouts
CREATE POLICY "Users can view their own payouts" ON commission_payouts
  FOR SELECT USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

CREATE POLICY "Users can manage their own payouts" ON commission_payouts
  FOR ALL USING (user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5');

-- Create RLS policies for payout_line_items
CREATE POLICY "Users can view their own payout items" ON payout_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_payouts 
      WHERE commission_payouts.id = payout_line_items.payout_id 
      AND commission_payouts.user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5'
    )
  );