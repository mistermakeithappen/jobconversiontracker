-- 005_sales_and_commissions.sql
-- Comprehensive sales tracking, products, and commission system

-- 1. GHL Products table
CREATE TABLE ghl_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
  
  UNIQUE(integration_id, ghl_product_id)
);

-- 2. Sales transactions table
CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
  payment_status VARCHAR(50) NOT NULL CHECK (
    payment_status IN ('completed', 'pending', 'failed', 'refunded', 'partially_refunded')
  ),
  transaction_type VARCHAR(50) NOT NULL CHECK (
    transaction_type IN ('sale', 'subscription_initial', 'subscription_renewal', 'refund', 'partial_refund')
  ),
  
  -- Subscription tracking
  subscription_id VARCHAR,
  subscription_period_start DATE,
  subscription_period_end DATE,
  is_first_payment BOOLEAN DEFAULT false,
  
  -- Team member assignment
  team_member_id UUID REFERENCES team_members(id),
  
  -- Additional data
  raw_webhook_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, ghl_payment_id)
);

-- 3. Commission structures (default rates per team member)
CREATE TABLE commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Commission settings
  commission_type VARCHAR(50) NOT NULL CHECK (
    commission_type IN ('gross', 'profit', 'tiered', 'flat', 'hybrid')
  ),
  
  -- Standard rates
  base_commission_rate DECIMAL(5,2) CHECK (base_commission_rate >= 0 AND base_commission_rate <= 100),
  subscription_initial_rate DECIMAL(5,2) CHECK (subscription_initial_rate >= 0 AND subscription_initial_rate <= 100),
  subscription_renewal_rate DECIMAL(5,2) CHECK (subscription_renewal_rate >= 0 AND subscription_renewal_rate <= 100),
  
  -- Tiered commission structure
  tiers JSONB DEFAULT '[]', -- Array of {min_amount, max_amount, rate}
  
  -- Additional settings
  applies_to_products JSONB DEFAULT '[]', -- Array of product IDs, empty = all products
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(team_member_id, effective_date)
);

-- 4. Commission rules (product or category specific)
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule scope
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('product', 'category', 'global')),
  
  -- Targeting
  product_ids JSONB DEFAULT '[]', -- Specific products
  categories JSONB DEFAULT '[]', -- Product categories
  team_member_ids JSONB DEFAULT '[]', -- Specific team members, empty = all
  
  -- Commission settings
  commission_type VARCHAR(50) NOT NULL CHECK (
    commission_type IN ('gross', 'profit', 'fixed', 'override')
  ),
  commission_value DECIMAL(10,2) NOT NULL, -- Percentage or fixed amount
  
  -- Rule conditions
  conditions JSONB DEFAULT '{}', -- e.g., {min_sale_amount: 1000}
  
  -- Priority and status
  priority INTEGER DEFAULT 0, -- Higher priority rules apply first
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, rule_name)
);

-- 5. Commission calculations
CREATE TABLE commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Commission details
  commission_type VARCHAR(50) NOT NULL,
  commission_percentage DECIMAL(5,2),
  commission_tier VARCHAR(50),
  base_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Rule tracking
  applied_structure_id UUID REFERENCES commission_structures(id),
  applied_rule_id UUID REFERENCES commission_rules(id),
  
  -- Profit calculation fields
  revenue_amount DECIMAL(10,2),
  expense_amount DECIMAL(10,2),
  profit_amount DECIMAL(10,2),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'paid', 'cancelled', 'on_hold')
  ),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Subscription verification
  requires_payment_verification BOOLEAN DEFAULT false,
  verification_status VARCHAR(50) CHECK (verification_status IN ('pending', 'verified', 'failed', NULL)),
  verification_date TIMESTAMP WITH TIME ZONE,
  next_verification_date DATE,
  
  -- Payout reference
  payout_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Commission payouts
CREATE TABLE commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Payout details
  payout_number VARCHAR UNIQUE,
  payout_date DATE NOT NULL,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Payment information
  payment_method VARCHAR(50) CHECK (
    payment_method IN ('direct_deposit', 'check', 'paypal', 'wire', 'other')
  ),
  payment_reference VARCHAR,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Summary stats
  commission_count INTEGER DEFAULT 0,
  total_sales_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Administrative
  generated_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Payout line items
CREATE TABLE payout_line_items (
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

-- 8. Pipeline stage analysis (for completion tracking)
CREATE TABLE pipeline_stage_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  
  -- Movement tracking
  entered_stage_at TIMESTAMP WITH TIME ZONE NOT NULL,
  exited_stage_at TIMESTAMP WITH TIME ZONE,
  time_in_stage INTERVAL GENERATED ALWAYS AS (
    exited_stage_at - entered_stage_at
  ) STORED, -- NULL for active stages; calculate with NOW() - entered_stage_at in queries
  
  -- Completion status
  is_completed BOOLEAN DEFAULT false,
  completion_type VARCHAR(50) CHECK (
    completion_type IN ('moved_forward', 'moved_backward', 'won', 'lost', NULL)
  ),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ghl_products_org ON ghl_products(organization_id);
CREATE INDEX idx_ghl_products_integration ON ghl_products(integration_id);
CREATE INDEX idx_ghl_products_ghl_id ON ghl_products(ghl_product_id);
CREATE INDEX idx_ghl_products_active ON ghl_products(is_active) WHERE is_active = true;

CREATE INDEX idx_sales_transactions_org ON sales_transactions(organization_id);
CREATE INDEX idx_sales_transactions_opportunity ON sales_transactions(opportunity_id);
CREATE INDEX idx_sales_transactions_contact ON sales_transactions(contact_id);
CREATE INDEX idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX idx_sales_transactions_payment_date ON sales_transactions(payment_date);
CREATE INDEX idx_sales_transactions_team_member ON sales_transactions(team_member_id);

CREATE INDEX idx_commission_structures_org ON commission_structures(organization_id);
CREATE INDEX idx_commission_structures_team_member ON commission_structures(team_member_id);
CREATE INDEX idx_commission_structures_active ON commission_structures(is_active, effective_date);

CREATE INDEX idx_commission_rules_org ON commission_rules(organization_id);
CREATE INDEX idx_commission_rules_active ON commission_rules(is_active, priority);

CREATE INDEX idx_commission_calculations_org ON commission_calculations(organization_id);
CREATE INDEX idx_commission_calculations_transaction ON commission_calculations(transaction_id);
CREATE INDEX idx_commission_calculations_team_member ON commission_calculations(team_member_id);
CREATE INDEX idx_commission_calculations_status ON commission_calculations(status);
CREATE INDEX idx_commission_calculations_payout ON commission_calculations(payout_id) WHERE payout_id IS NOT NULL;

CREATE INDEX idx_commission_payouts_org ON commission_payouts(organization_id);
CREATE INDEX idx_commission_payouts_team_member ON commission_payouts(team_member_id);
CREATE INDEX idx_commission_payouts_payout_number ON commission_payouts(payout_number);
CREATE INDEX idx_commission_payouts_status ON commission_payouts(payment_status);

CREATE INDEX idx_payout_line_items_payout ON payout_line_items(payout_id);
CREATE INDEX idx_payout_line_items_commission ON payout_line_items(commission_id);

CREATE INDEX idx_pipeline_stage_analysis_org ON pipeline_stage_analysis(organization_id);
CREATE INDEX idx_pipeline_stage_analysis_stage ON pipeline_stage_analysis(pipeline_stage_id);
CREATE INDEX idx_pipeline_stage_analysis_opportunity ON pipeline_stage_analysis(opportunity_id);

-- Create triggers
CREATE TRIGGER update_ghl_products_updated_at BEFORE UPDATE ON ghl_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_transactions_updated_at BEFORE UPDATE ON sales_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_structures_updated_at BEFORE UPDATE ON commission_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_rules_updated_at BEFORE UPDATE ON commission_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_calculations_updated_at BEFORE UPDATE ON commission_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_payouts_updated_at BEFORE UPDATE ON commission_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ghl_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_analysis ENABLE ROW LEVEL SECURITY;

-- Add foreign key for payout_id after commission_payouts is created
ALTER TABLE commission_calculations 
  ADD CONSTRAINT fk_commission_calculations_payout 
  FOREIGN KEY (payout_id) REFERENCES commission_payouts(id);