-- 016_product_commission_system.sql
-- Product-based commission tracking, recurring revenue, and gamification

-- 1. Product-specific commission rules
CREATE TABLE commission_product_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ghl_products(id) ON DELETE CASCADE,
  
  -- Commission rates
  initial_sale_rate DECIMAL(5,2) DEFAULT 10 CHECK (initial_sale_rate >= 0 AND initial_sale_rate <= 100),
  renewal_rate DECIMAL(5,2) DEFAULT 5 CHECK (renewal_rate >= 0 AND renewal_rate <= 100),
  
  -- MRR settings
  mrr_commission_type VARCHAR(50) DEFAULT 'duration' CHECK (mrr_commission_type IN (
    'first_payment_only', 'duration', 'lifetime', 'trailing'
  )),
  mrr_duration_months INTEGER DEFAULT 12,
  trailing_months INTEGER DEFAULT 6,
  
  -- Clawback rules
  clawback_enabled BOOLEAN DEFAULT false,
  clawback_period_days INTEGER DEFAULT 90,
  clawback_percentage DECIMAL(5,2) DEFAULT 100,
  
  -- Special rules
  min_sale_amount DECIMAL(10,2),
  max_commission_amount DECIMAL(10,2),
  requires_manager_approval BOOLEAN DEFAULT false,
  approval_threshold DECIMAL(10,2),
  
  -- Product margin validation
  max_commission_of_margin DECIMAL(5,2) DEFAULT 50, -- Max % of profit margin
  estimated_margin_percentage DECIMAL(5,2), -- Product profit margin
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, product_id, effective_date)
);

-- 2. Recurring commission tracking
CREATE TABLE recurring_commission_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  product_id UUID NOT NULL REFERENCES ghl_products(id),
  subscription_id VARCHAR NOT NULL,
  
  -- Tracking details
  tracking_type VARCHAR(50) NOT NULL CHECK (tracking_type IN (
    'initial', 'renewal', 'trailing', 'clawback'
  )),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_number INTEGER NOT NULL, -- Which payment period this is
  
  -- Commission details
  base_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'pending', 'earned', 'paid', 'clawedback', 'cancelled'
  )),
  earned_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Subscription lifecycle tracking
CREATE TABLE subscription_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id VARCHAR NOT NULL,
  product_id UUID REFERENCES ghl_products(id),
  contact_id VARCHAR NOT NULL,
  
  -- Lifecycle events
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'created', 'activated', 'renewed', 'upgraded', 'downgraded', 
    'paused', 'resumed', 'cancelled', 'expired', 'payment_failed'
  )),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Subscription details at time of event
  mrr_amount DECIMAL(10,2),
  billing_cycle VARCHAR(50),
  next_billing_date DATE,
  
  -- Impact on commissions
  commission_impact VARCHAR(50) CHECK (commission_impact IN (
    'new_commission', 'continue_commission', 'pause_commission', 
    'stop_commission', 'clawback_triggered', NULL
  )),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Gamification challenges
CREATE TABLE gamification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Challenge details
  challenge_name VARCHAR(255) NOT NULL,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'product_sales', 'revenue_target', 'new_products', 'team_competition', 
    'personal_best', 'streak', 'milestone'
  )),
  description TEXT,
  
  -- Target configuration
  target_metric VARCHAR(100) NOT NULL, -- e.g., 'product_count', 'revenue', 'mrr'
  target_value DECIMAL(12,2) NOT NULL,
  target_product_ids JSONB DEFAULT '[]', -- Specific products for the challenge
  
  -- Timeframe
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Rewards
  reward_type VARCHAR(50) CHECK (reward_type IN (
    'bonus_percentage', 'fixed_bonus', 'achievement', 'multiplier'
  )),
  reward_value DECIMAL(10,2),
  achievement_badge VARCHAR(100),
  
  -- Participation
  participant_type VARCHAR(50) DEFAULT 'individual' CHECK (participant_type IN (
    'individual', 'team', 'organization'
  )),
  eligible_team_members JSONB DEFAULT '[]', -- Empty = all eligible
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 5. Achievement tracking
CREATE TABLE gamification_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  challenge_id UUID REFERENCES gamification_challenges(id),
  
  -- Achievement details
  achievement_type VARCHAR(100) NOT NULL,
  achievement_name VARCHAR(255) NOT NULL,
  achievement_level VARCHAR(50), -- bronze, silver, gold, platinum
  
  -- Progress tracking
  current_value DECIMAL(12,2) DEFAULT 0,
  target_value DECIMAL(12,2),
  progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN target_value > 0 THEN (current_value / target_value * 100)
      ELSE 0 
    END
  ) STORED,
  
  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Reward tracking
  reward_earned DECIMAL(10,2),
  reward_paid BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(team_member_id, challenge_id)
);

-- 6. Leaderboard snapshots
CREATE TABLE gamification_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Leaderboard details
  leaderboard_type VARCHAR(50) NOT NULL CHECK (leaderboard_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'all_time', 'challenge'
  )),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  challenge_id UUID REFERENCES gamification_challenges(id),
  
  -- Rankings (stored as JSONB for flexibility and performance)
  rankings JSONB NOT NULL, -- Array of {team_member_id, rank, score, metrics}
  
  -- Metadata
  metric_type VARCHAR(100) NOT NULL,
  total_participants INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Product performance analytics
CREATE TABLE product_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ghl_products(id),
  
  -- Time period
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  
  -- Sales metrics
  units_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  avg_sale_price DECIMAL(10,2),
  
  -- Performance metrics
  conversion_rate DECIMAL(5,2),
  days_to_sale_avg DECIMAL(6,2),
  return_rate DECIMAL(5,2),
  
  -- Commission metrics
  total_commissions_paid DECIMAL(12,2) DEFAULT 0,
  avg_commission_rate DECIMAL(5,2),
  
  -- Top performers
  top_performers JSONB DEFAULT '[]', -- Array of {team_member_id, units, revenue}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, product_id, snapshot_date, period_type)
);

-- 8. Commission validation audit
CREATE TABLE commission_validation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  
  -- Validation results
  validation_status VARCHAR(50) NOT NULL CHECK (validation_status IN (
    'passed', 'warning', 'failed', 'override'
  )),
  
  -- Validation checks performed
  checks_performed JSONB NOT NULL, -- Array of {check_name, result, message}
  
  -- Override details (if applicable)
  override_reason TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMP WITH TIME ZONE,
  
  -- Manager approval (if required)
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50) CHECK (approval_status IN (
    'pending', 'approved', 'rejected', NULL
  )),
  approved_by UUID REFERENCES users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_commission_product_rules_org ON commission_product_rules(organization_id);
CREATE INDEX idx_commission_product_rules_product ON commission_product_rules(product_id);
CREATE INDEX idx_commission_product_rules_active ON commission_product_rules(is_active, effective_date);

CREATE INDEX idx_recurring_tracking_org ON recurring_commission_tracking(organization_id);
CREATE INDEX idx_recurring_tracking_subscription ON recurring_commission_tracking(subscription_id);
CREATE INDEX idx_recurring_tracking_status ON recurring_commission_tracking(status);
CREATE INDEX idx_recurring_tracking_period ON recurring_commission_tracking(period_start, period_end);

CREATE INDEX idx_subscription_lifecycle_org ON subscription_lifecycle(organization_id);
CREATE INDEX idx_subscription_lifecycle_subscription ON subscription_lifecycle(subscription_id);
CREATE INDEX idx_subscription_lifecycle_event ON subscription_lifecycle(event_type, event_date);

CREATE INDEX idx_gamification_challenges_org ON gamification_challenges(organization_id);
CREATE INDEX idx_gamification_challenges_active ON gamification_challenges(is_active, start_date, end_date);

CREATE INDEX idx_gamification_achievements_member ON gamification_achievements(team_member_id);
CREATE INDEX idx_gamification_achievements_challenge ON gamification_achievements(challenge_id);
CREATE INDEX idx_gamification_achievements_completed ON gamification_achievements(completed_at) WHERE completed_at IS NOT NULL;

CREATE INDEX idx_gamification_leaderboards_org ON gamification_leaderboards(organization_id);
CREATE INDEX idx_gamification_leaderboards_period ON gamification_leaderboards(period_start, period_end);

CREATE INDEX idx_product_analytics_org ON product_analytics_snapshots(organization_id);
CREATE INDEX idx_product_analytics_product ON product_analytics_snapshots(product_id);
CREATE INDEX idx_product_analytics_date ON product_analytics_snapshots(snapshot_date);

CREATE INDEX idx_validation_audit_commission ON commission_validation_audit(commission_record_id);
CREATE INDEX idx_validation_audit_approval ON commission_validation_audit(requires_approval, approval_status);

-- Add product_id to commission_assignments for product-specific assignments
-- Note: subscription_initial_rate and subscription_renewal_rate already exist from migration 014
ALTER TABLE commission_assignments 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES ghl_products(id),
ADD COLUMN IF NOT EXISTS mrr_duration_months INTEGER,
ADD COLUMN IF NOT EXISTS trailing_commission_months INTEGER;

-- Add product_id to commission_events for product sales tracking
ALTER TABLE commission_events
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES ghl_products(id),
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR;

-- Create triggers
CREATE TRIGGER update_commission_product_rules_updated_at 
  BEFORE UPDATE ON commission_product_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_tracking_updated_at 
  BEFORE UPDATE ON recurring_commission_tracking 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_challenges_updated_at 
  BEFORE UPDATE ON gamification_challenges 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_achievements_updated_at 
  BEFORE UPDATE ON gamification_achievements 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE commission_product_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_commission_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_validation_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization members can manage product commission rules" ON commission_product_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_product_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view recurring commissions" ON recurring_commission_tracking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = recurring_commission_tracking.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view subscription lifecycle" ON subscription_lifecycle
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = subscription_lifecycle.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view challenges" ON gamification_challenges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = gamification_challenges.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Team members can view their achievements" ON gamification_achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN organization_members om ON om.organization_id = tm.organization_id
      WHERE tm.id = gamification_achievements.team_member_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view leaderboards" ON gamification_leaderboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = gamification_leaderboards.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view product analytics" ON product_analytics_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = product_analytics_snapshots.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view validation audits" ON commission_validation_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_records cr
      JOIN organization_members om ON om.organization_id = cr.organization_id
      WHERE cr.id = commission_validation_audit.commission_record_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Helper function to calculate recurring commissions
CREATE OR REPLACE FUNCTION calculate_recurring_commission(
  p_subscription_id VARCHAR,
  p_product_id UUID,
  p_period_number INTEGER,
  p_amount DECIMAL(10,2)
) RETURNS TABLE (
  commission_rate DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  tracking_type VARCHAR(50)
) AS $$
DECLARE
  v_rule commission_product_rules%ROWTYPE;
  v_rate DECIMAL(5,2);
  v_type VARCHAR(50);
BEGIN
  -- Get the product commission rule
  SELECT * INTO v_rule 
  FROM commission_product_rules 
  WHERE product_id = p_product_id 
    AND is_active = true 
    AND CURRENT_DATE BETWEEN COALESCE(effective_date, CURRENT_DATE) AND COALESCE(expiry_date, CURRENT_DATE)
  ORDER BY priority DESC 
  LIMIT 1;
  
  -- Determine commission rate and type based on period
  IF p_period_number = 1 THEN
    v_rate := COALESCE(v_rule.initial_sale_rate, 10);
    v_type := 'initial';
  ELSIF v_rule.mrr_commission_type = 'first_payment_only' THEN
    RETURN; -- No commission after first payment
  ELSIF v_rule.mrr_commission_type = 'duration' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) THEN
    RETURN; -- Duration exceeded
  ELSIF v_rule.mrr_commission_type = 'trailing' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) + COALESCE(v_rule.trailing_months, 6) THEN
    RETURN; -- Trailing period exceeded
  ELSIF v_rule.mrr_commission_type = 'trailing' AND p_period_number > COALESCE(v_rule.mrr_duration_months, 12) THEN
    v_rate := COALESCE(v_rule.renewal_rate, 5) * 0.5; -- Reduced rate for trailing
    v_type := 'trailing';
  ELSE
    v_rate := COALESCE(v_rule.renewal_rate, 5);
    v_type := 'renewal';
  END IF;
  
  RETURN QUERY SELECT 
    v_rate,
    p_amount * (v_rate / 100),
    v_type;
END;
$$ LANGUAGE plpgsql;

-- Function to check commission validation rules
CREATE OR REPLACE FUNCTION validate_commission(
  p_commission_record_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_commission commission_records%ROWTYPE;
  v_event commission_events%ROWTYPE;
  v_product ghl_products%ROWTYPE;
  v_rule commission_product_rules%ROWTYPE;
  v_checks JSONB := '[]'::JSONB;
  v_status VARCHAR(50) := 'passed';
  v_requires_approval BOOLEAN := false;
BEGIN
  -- Get commission details
  SELECT * INTO v_commission FROM commission_records WHERE id = p_commission_record_id;
  SELECT * INTO v_event FROM commission_events WHERE id = v_commission.event_id;
  
  -- If product-based, get product and rules
  IF v_event.product_id IS NOT NULL THEN
    SELECT * INTO v_product FROM ghl_products WHERE id = v_event.product_id;
    SELECT * INTO v_rule FROM commission_product_rules 
    WHERE product_id = v_event.product_id 
      AND is_active = true 
    ORDER BY priority DESC 
    LIMIT 1;
    
    -- Check 1: Product active status
    IF NOT v_product.is_active THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'product_active',
        'result', 'failed',
        'message', 'Product is not active'
      );
      v_status := 'failed';
    END IF;
    
    -- Check 2: Commission vs margin
    IF v_rule.estimated_margin_percentage IS NOT NULL AND v_rule.max_commission_of_margin IS NOT NULL THEN
      IF (v_commission.commission_rate > (v_rule.estimated_margin_percentage * v_rule.max_commission_of_margin / 100)) THEN
        v_checks := v_checks || jsonb_build_object(
          'check_name', 'margin_check',
          'result', 'warning',
          'message', 'Commission exceeds allowed percentage of profit margin'
        );
        IF v_status != 'failed' THEN v_status := 'warning'; END IF;
      END IF;
    END IF;
    
    -- Check 3: Min/Max amounts
    IF v_rule.min_sale_amount IS NOT NULL AND v_event.event_amount < v_rule.min_sale_amount THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'min_amount',
        'result', 'failed',
        'message', 'Sale amount below minimum for commission'
      );
      v_status := 'failed';
    END IF;
    
    IF v_rule.max_commission_amount IS NOT NULL AND v_commission.commission_amount > v_rule.max_commission_amount THEN
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'max_commission',
        'result', 'warning',
        'message', 'Commission exceeds maximum allowed amount'
      );
      IF v_status != 'failed' THEN v_status := 'warning'; END IF;
    END IF;
    
    -- Check 4: Manager approval required
    IF v_rule.requires_manager_approval OR 
       (v_rule.approval_threshold IS NOT NULL AND v_commission.commission_amount > v_rule.approval_threshold) THEN
      v_requires_approval := true;
      v_checks := v_checks || jsonb_build_object(
        'check_name', 'approval_required',
        'result', 'info',
        'message', 'Manager approval required for this commission'
      );
    END IF;
  END IF;
  
  -- Return validation results
  RETURN jsonb_build_object(
    'status', v_status,
    'requires_approval', v_requires_approval,
    'checks', v_checks
  );
END;
$$ LANGUAGE plpgsql;