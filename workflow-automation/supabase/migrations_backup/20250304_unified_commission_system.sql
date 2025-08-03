-- Unified Commission System Migration
-- Simplifies to one commission structure per user with opportunity-level overrides

-- 1. Create user_commission_structures table (one per user)
CREATE TABLE IF NOT EXISTS user_commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Commission Structure
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('gross', 'profit', 'tiered', 'flat', 'hybrid')),
  commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  base_commission DECIMAL(10,2), -- For flat or hybrid commissions
  
  -- Tiered commission structure (stored as JSONB)
  commission_tiers JSONB, -- Array of {threshold: number, percentage: number}
  
  -- Application Rules
  applies_to VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'one_time', 'recurring', 'specific_products')),
  applicable_product_ids UUID[], -- References to ghl_products
  
  -- Recurring Revenue Rules
  mrr_commission_type VARCHAR(50) DEFAULT 'all_payments' CHECK (mrr_commission_type IN ('first_payment_only', 'all_payments', 'trailing', 'duration_based')),
  mrr_duration_months INTEGER DEFAULT 12, -- For duration-based MRR commissions
  mrr_trailing_months INTEGER DEFAULT 3, -- How many months to pay trailing commissions
  mrr_percentage_override DECIMAL(5,2), -- Different percentage for recurring vs one-time
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one active structure per user per integration
  UNIQUE(user_id, integration_id)
);

-- 2. Create opportunity_commission_overrides table for deal-specific rates
CREATE TABLE IF NOT EXISTS opportunity_commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL, -- GHL opportunity ID
  ghl_user_id VARCHAR NOT NULL, -- Sales person assigned to opportunity
  
  -- Override commission settings
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('gross', 'profit', 'tiered', 'flat', 'hybrid')),
  commission_percentage DECIMAL(5,2) CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  base_commission DECIMAL(10,2),
  commission_tiers JSONB,
  
  -- Recurring overrides
  mrr_commission_type VARCHAR(50) CHECK (mrr_commission_type IN ('first_payment_only', 'all_payments', 'trailing', 'duration_based')),
  mrr_duration_months INTEGER,
  mrr_trailing_months INTEGER, 
  mrr_percentage_override DECIMAL(5,2),
  
  -- Metadata
  override_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique override per opportunity
  UNIQUE(integration_id, opportunity_id, ghl_user_id)
);

-- 3. Create a migration data table to track commission rule migration
CREATE TABLE IF NOT EXISTS commission_migration_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_commission_rule_id UUID,
  new_user_structure_id UUID,
  migration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  migration_notes TEXT
);

-- 4. Migrate existing commission_rules to user_commission_structures
-- This will take the highest priority rule per user and make it their default structure
INSERT INTO user_commission_structures (
  user_id, integration_id, commission_type, commission_percentage, 
  base_commission, commission_tiers, applies_to, applicable_product_ids,
  mrr_commission_type, mrr_duration_months, mrr_trailing_months, 
  mrr_percentage_override, is_active, effective_date, notes, created_at, updated_at
)
SELECT DISTINCT ON (cr.user_id, cr.integration_id)
  cr.user_id, cr.integration_id, cr.commission_type, cr.commission_percentage,
  cr.base_commission, cr.commission_tiers, cr.applies_to, cr.applicable_product_ids,
  cr.mrr_commission_type, cr.mrr_duration_months, cr.mrr_trailing_months,
  cr.mrr_percentage_override, cr.is_active, cr.effective_date, cr.notes, 
  cr.created_at, cr.updated_at
FROM commission_rules cr
WHERE cr.is_active = true
ORDER BY cr.user_id, cr.integration_id, cr.priority DESC, cr.created_at DESC
ON CONFLICT (user_id, integration_id) DO NOTHING;

-- 5. Track migrated rules
INSERT INTO commission_migration_tracking (old_commission_rule_id, new_user_structure_id, migration_notes)
SELECT 
  cr.id as old_commission_rule_id,
  ucs.id as new_user_structure_id,
  'Migrated highest priority rule to default user structure'
FROM commission_rules cr
JOIN user_commission_structures ucs ON (
  cr.user_id = ucs.user_id AND 
  cr.integration_id = ucs.integration_id AND
  cr.commission_type = ucs.commission_type AND
  cr.commission_percentage = ucs.commission_percentage
)
WHERE cr.is_active = true;

-- 6. Update commission_calculations to reference user_commission_structures
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS user_commission_structure_id UUID REFERENCES user_commission_structures(id);
ALTER TABLE commission_calculations ADD COLUMN IF NOT EXISTS opportunity_override_id UUID REFERENCES opportunity_commission_overrides(id);

-- Update existing calculations to reference new structure
UPDATE commission_calculations cc
SET user_commission_structure_id = ucs.id
FROM user_commission_structures ucs, commission_rules cr
WHERE cc.commission_rule_id = cr.id
  AND cr.user_id = ucs.user_id 
  AND cr.integration_id = ucs.integration_id;

-- 7. Create updated unified commission view
DROP VIEW IF EXISTS unified_commissions;
CREATE OR REPLACE VIEW unified_commissions AS
-- Opportunity commissions (pipeline-based)
SELECT 
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
  'pipeline' as sale_type,
  NULL as transaction_id,
  NULL as is_recurring,
  NULL as recurring_month_number
FROM opportunity_commissions oc

UNION ALL

-- Sales transaction commissions (direct sales)
SELECT 
  cc.id,
  cc.user_id,
  cc.opportunity_id,
  cc.ghl_user_id,
  ucs.user_name,
  ucs.user_email,
  cc.commission_type,
  cc.commission_percentage,
  cc.commission_amount,
  cc.created_at,
  'sales' as source,
  CASE WHEN cc.is_recurring THEN 'recurring' ELSE 'one_time' END as sale_type,
  cc.transaction_id,
  cc.is_recurring,
  cc.recurring_month_number
FROM commission_calculations cc
LEFT JOIN user_commission_structures ucs ON cc.user_commission_structure_id = ucs.id;

-- 8. Create helper function to get commission structure for user
CREATE OR REPLACE FUNCTION get_user_commission_structure(
  p_user_id UUID,
  p_integration_id UUID,
  p_ghl_user_id VARCHAR DEFAULT NULL
) RETURNS user_commission_structures AS $$
DECLARE
  v_structure user_commission_structures;
BEGIN
  -- Try to get user's default commission structure
  SELECT * INTO v_structure 
  FROM user_commission_structures 
  WHERE user_id = p_user_id 
    AND integration_id = p_integration_id 
    AND is_active = true
  LIMIT 1;
  
  RETURN v_structure;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to get commission structure with opportunity override
CREATE OR REPLACE FUNCTION get_effective_commission_structure(
  p_user_id UUID,
  p_integration_id UUID,
  p_opportunity_id VARCHAR,
  p_ghl_user_id VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_base_structure user_commission_structures;
  v_override opportunity_commission_overrides;
  v_result JSONB;
BEGIN
  -- Get base structure
  SELECT * INTO v_base_structure
  FROM user_commission_structures
  WHERE user_id = p_user_id AND integration_id = p_integration_id AND is_active = true;
  
  -- Check for opportunity override
  SELECT * INTO v_override
  FROM opportunity_commission_overrides
  WHERE integration_id = p_integration_id 
    AND opportunity_id = p_opportunity_id
    AND ghl_user_id = p_ghl_user_id;
  
  -- Build result JSON
  IF v_override.id IS NOT NULL THEN
    -- Use override
    v_result := jsonb_build_object(
      'source', 'override',
      'override_id', v_override.id,
      'commission_type', v_override.commission_type,
      'commission_percentage', v_override.commission_percentage,
      'base_commission', v_override.base_commission,
      'commission_tiers', v_override.commission_tiers,
      'mrr_commission_type', v_override.mrr_commission_type,
      'mrr_duration_months', v_override.mrr_duration_months,
      'mrr_trailing_months', v_override.mrr_trailing_months,
      'mrr_percentage_override', v_override.mrr_percentage_override
    );
  ELSIF v_base_structure.id IS NOT NULL THEN
    -- Use base structure
    v_result := jsonb_build_object(
      'source', 'user_default',
      'structure_id', v_base_structure.id,
      'commission_type', v_base_structure.commission_type,
      'commission_percentage', v_base_structure.commission_percentage,
      'base_commission', v_base_structure.base_commission,
      'commission_tiers', v_base_structure.commission_tiers,
      'mrr_commission_type', v_base_structure.mrr_commission_type,
      'mrr_duration_months', v_base_structure.mrr_duration_months,
      'mrr_trailing_months', v_base_structure.mrr_trailing_months,
      'mrr_percentage_override', v_base_structure.mrr_percentage_override
    );
  ELSE
    -- No structure found
    v_result := jsonb_build_object('source', 'none');
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_commission_structures_user_id ON user_commission_structures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_commission_structures_integration_id ON user_commission_structures(integration_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commission_overrides_opportunity_id ON opportunity_commission_overrides(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commission_overrides_ghl_user_id ON opportunity_commission_overrides(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commission_overrides_integration_id ON opportunity_commission_overrides(integration_id);

-- 11. Create triggers
CREATE TRIGGER update_user_commission_structures_updated_at 
    BEFORE UPDATE ON user_commission_structures 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunity_commission_overrides_updated_at 
    BEFORE UPDATE ON opportunity_commission_overrides 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Enable RLS
ALTER TABLE user_commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_commission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_migration_tracking ENABLE ROW LEVEL SECURITY;

-- 13. Create policies
CREATE POLICY "Users can manage their own commission structures" ON user_commission_structures
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own opportunity overrides" ON opportunity_commission_overrides
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view migration tracking" ON commission_migration_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_commission_structures ucs 
            WHERE ucs.id = commission_migration_tracking.new_user_structure_id 
            AND ucs.user_id = auth.uid()
        )
    );

-- 14. Add helpful comments
COMMENT ON TABLE user_commission_structures IS 'Single commission structure per user - replaces multiple commission rules with priority';
COMMENT ON TABLE opportunity_commission_overrides IS 'Deal-specific commission overrides for individual opportunities';
COMMENT ON COLUMN user_commission_structures.applies_to IS 'Determines which types of transactions this structure applies to';
COMMENT ON COLUMN user_commission_structures.mrr_commission_type IS 'Defines how commissions are paid on recurring revenue';
COMMENT ON VIEW unified_commissions IS 'Unified view of all commissions from both pipeline opportunities and direct sales';

-- 15. Mark old commission_rules table as deprecated (don't drop yet for safety)
COMMENT ON TABLE commission_rules IS 'DEPRECATED: Replaced by user_commission_structures and opportunity_commission_overrides. Keep for migration rollback if needed.';