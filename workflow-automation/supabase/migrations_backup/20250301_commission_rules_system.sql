-- Create commission rules system for both one-off and recurring revenues
-- This unifies opportunity commissions with sales commissions

-- 1. Create commission_rules table for global commission configurations
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL User Information
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  user_phone VARCHAR,
  
  -- Commission Structure
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('gross', 'profit', 'tiered', 'flat', 'hybrid')),
  commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  base_commission DECIMAL(10,2), -- For flat or hybrid commissions
  
  -- Tiered commission structure (stored as JSONB)
  commission_tiers JSONB, -- Array of {threshold: number, percentage: number}
  
  -- Application Rules
  applies_to VARCHAR(50) NOT NULL CHECK (applies_to IN ('all', 'one_time', 'recurring', 'specific_products')),
  applicable_product_ids UUID[], -- References to ghl_products
  
  -- Recurring Revenue Rules
  mrr_commission_type VARCHAR(50) CHECK (mrr_commission_type IN ('first_payment_only', 'all_payments', 'trailing', 'duration_based')),
  mrr_duration_months INTEGER, -- For duration-based MRR commissions
  mrr_trailing_months INTEGER, -- How many months to pay trailing commissions
  mrr_percentage_override DECIMAL(5,2), -- Different percentage for recurring vs one-time
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Higher priority rules override lower ones
  effective_date DATE DEFAULT CURRENT_DATE,
  expiration_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique active rule per GHL user per integration
  UNIQUE(integration_id, ghl_user_id)
);

-- 2. Update commission_calculations table to support MRR tracking
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS commission_rule_id UUID REFERENCES commission_rules(id);
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS recurring_month_number INTEGER; -- 1 for first month, 2 for second, etc.
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS recurring_end_date DATE; -- When recurring commissions stop

-- 3. Create commission_rule_history for audit trail
CREATE TABLE IF NOT EXISTS commission_rule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_rule_id UUID NOT NULL REFERENCES commission_rules(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'updated', 'deactivated', 'reactivated')),
  previous_values JSONB,
  new_values JSONB,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create view to unify opportunity and sales commissions
CREATE OR REPLACE VIEW unified_commissions AS
SELECT 
  -- Common fields
  oc.id,
  oc.user_id,
  oc.opportunity_id,
  oc.ghl_user_id,
  oc.user_name,
  oc.user_email,
  oc.commission_type,
  oc.commission_percentage,
  oc.commission_amount,
  oc.created_at,
  'opportunity' as source,
  NULL as transaction_id,
  NULL as is_recurring
FROM opportunity_commissions oc

UNION ALL

SELECT 
  cc.id,
  cc.user_id,
  cc.opportunity_id,
  cc.ghl_user_id,
  cr.user_name,
  cr.user_email,
  cc.commission_type,
  cc.commission_percentage,
  cc.commission_amount,
  cc.created_at,
  'sales' as source,
  cc.transaction_id,
  cc.is_recurring
FROM commission_calculations cc
LEFT JOIN commission_rules cr ON cc.ghl_user_id = cr.ghl_user_id;

-- 5. Create function to calculate commission based on rules
CREATE OR REPLACE FUNCTION calculate_commission_amount(
  p_base_amount DECIMAL,
  p_commission_rule_id UUID,
  p_is_recurring BOOLEAN DEFAULT FALSE,
  p_recurring_month INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
DECLARE
  v_rule commission_rules;
  v_commission_amount DECIMAL;
  v_percentage DECIMAL;
BEGIN
  -- Get the commission rule
  SELECT * INTO v_rule FROM commission_rules WHERE id = p_commission_rule_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Check if rule applies to this type of transaction
  IF (p_is_recurring AND v_rule.applies_to = 'one_time') OR
     (NOT p_is_recurring AND v_rule.applies_to = 'recurring') THEN
    RETURN 0;
  END IF;
  
  -- For recurring, check MRR rules
  IF p_is_recurring THEN
    -- Check if we should pay commission for this month
    CASE v_rule.mrr_commission_type
      WHEN 'first_payment_only' THEN
        IF p_recurring_month > 1 THEN RETURN 0; END IF;
      WHEN 'duration_based' THEN
        IF p_recurring_month > COALESCE(v_rule.mrr_duration_months, 12) THEN RETURN 0; END IF;
      WHEN 'trailing' THEN
        IF p_recurring_month > COALESCE(v_rule.mrr_trailing_months, 3) THEN RETURN 0; END IF;
    END CASE;
    
    -- Use MRR percentage override if available
    v_percentage := COALESCE(v_rule.mrr_percentage_override, v_rule.commission_percentage);
  ELSE
    v_percentage := v_rule.commission_percentage;
  END IF;
  
  -- Calculate based on commission type
  CASE v_rule.commission_type
    WHEN 'gross', 'profit' THEN
      v_commission_amount := p_base_amount * (v_percentage / 100);
    WHEN 'flat' THEN
      v_commission_amount := v_rule.base_commission;
    WHEN 'hybrid' THEN
      v_commission_amount := v_rule.base_commission + (p_base_amount * (v_percentage / 100));
    WHEN 'tiered' THEN
      -- Implement tiered calculation based on commission_tiers JSONB
      -- This is simplified - you'd need to implement the full tiered logic
      v_commission_amount := p_base_amount * (v_percentage / 100);
  END CASE;
  
  RETURN v_commission_amount;
END;
$$ LANGUAGE plpgsql;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_rules_ghl_user_id ON commission_rules(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_integration_id ON commission_rules(integration_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON commission_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_commission_rule_history_rule_id ON commission_rule_history(commission_rule_id);

-- 7. Create triggers
CREATE TRIGGER update_commission_rules_updated_at 
    BEFORE UPDATE ON commission_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable RLS
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rule_history ENABLE ROW LEVEL SECURITY;

-- 9. Create policies
CREATE POLICY "Users can view their own commission rules" ON commission_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own commission rules" ON commission_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own commission rules" ON commission_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own commission rules" ON commission_rules
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view commission rule history" ON commission_rule_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM commission_rules cr 
            WHERE cr.id = commission_rule_history.commission_rule_id 
            AND cr.user_id = auth.uid()
        )
    );

-- 10. Add helpful comments
COMMENT ON TABLE commission_rules IS 'Global commission configuration for sales reps, supporting both one-time and recurring revenue models';
COMMENT ON COLUMN commission_rules.applies_to IS 'Determines which types of transactions this rule applies to';
COMMENT ON COLUMN commission_rules.mrr_commission_type IS 'Defines how commissions are paid on recurring revenue';
COMMENT ON COLUMN commission_rules.mrr_duration_months IS 'For duration-based MRR: how many months to pay commissions';
COMMENT ON COLUMN commission_rules.mrr_trailing_months IS 'For trailing MRR: how many months after initial sale to continue paying';
COMMENT ON COLUMN commission_rules.priority IS 'When multiple rules could apply, higher priority wins';