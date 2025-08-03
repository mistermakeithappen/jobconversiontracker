-- 015_unified_commission_system_update.sql
-- Updates existing commission system to support unified tracking

-- 1. Commission Events - Track all events that can generate commissions
CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event source and type
  event_source VARCHAR(50) NOT NULL CHECK (event_source IN (
    'opportunity', 'payment', 'estimate', 'invoice', 'subscription', 'manual'
  )),
  event_type VARCHAR(100) NOT NULL, -- e.g., 'opportunity_won', 'payment_collected', 'estimate_sent', 'invoice_paid'
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- References to source records
  opportunity_id VARCHAR, -- GHL opportunity ID
  payment_id VARCHAR, -- GHL payment ID
  invoice_id VARCHAR, -- GHL invoice ID
  estimate_id VARCHAR, -- GHL estimate ID
  contact_id VARCHAR NOT NULL, -- GHL contact ID
  
  -- Financial details
  event_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Event metadata
  event_data JSONB DEFAULT '{}', -- Store additional event-specific data
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Commission Assignments - Define who gets commissions for what
CREATE TABLE IF NOT EXISTS commission_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Assignment scope
  assignment_type VARCHAR(50) NOT NULL CHECK (assignment_type IN (
    'opportunity', 'team_member', 'role', 'global'
  )),
  
  -- Who gets the commission
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR, -- For backwards compatibility
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- What they get commission on
  opportunity_id VARCHAR, -- Specific opportunity (if assignment_type = 'opportunity')
  role_name VARCHAR, -- Role-based assignment (if assignment_type = 'role')
  
  -- Commission structure
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN (
    'percentage_gross', 'percentage_profit', 'fixed_amount', 'tiered', 'hybrid'
  )),
  base_rate DECIMAL(5,2) CHECK (base_rate >= 0 AND base_rate <= 100),
  fixed_amount DECIMAL(10,2),
  
  -- Event-specific rates (can override base_rate)
  payment_collected_rate DECIMAL(5,2),
  estimate_sent_rate DECIMAL(5,2),
  invoice_paid_rate DECIMAL(5,2),
  opportunity_won_rate DECIMAL(5,2),
  subscription_initial_rate DECIMAL(5,2),
  subscription_renewal_rate DECIMAL(5,2),
  
  -- Tiered commission structure
  tier_config JSONB DEFAULT '[]', -- Array of {min_amount, max_amount, rate}
  
  -- Pipeline stage requirements (optional)
  required_pipeline_id VARCHAR, -- Which pipeline this applies to
  required_stage_id VARCHAR, -- Stage that must be reached for commission eligibility
  required_stage_name VARCHAR, -- Human-readable stage name for reference
  stage_requirement_type VARCHAR(50) DEFAULT 'reached' CHECK (
    stage_requirement_type IN ('reached', 'completed', 'won', NULL)
  ),
  
  -- Assignment metadata
  priority INTEGER DEFAULT 0, -- Higher priority assignments override lower ones
  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT valid_assignment CHECK (
    (assignment_type = 'opportunity' AND opportunity_id IS NOT NULL) OR
    (assignment_type = 'team_member' AND team_member_id IS NOT NULL) OR
    (assignment_type = 'role' AND role_name IS NOT NULL) OR
    (assignment_type = 'global')
  )
);

-- 3. Commission Records - Actual calculated commissions (renamed from commission_calculations)
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Link to event and assignment
  event_id UUID REFERENCES commission_events(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES commission_assignments(id),
  
  -- Who earned the commission
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Commission calculation
  base_amount DECIMAL(12,2) NOT NULL, -- Amount commission is calculated on
  commission_rate DECIMAL(5,2), -- Rate applied (if percentage)
  commission_amount DECIMAL(12,2) NOT NULL, -- Calculated commission
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Calculation details
  calculation_method VARCHAR(100), -- How it was calculated
  calculation_details JSONB DEFAULT '{}', -- Breakdown of calculation
  
  -- Profit calculations (if applicable)
  revenue_amount DECIMAL(12,2),
  expense_amount DECIMAL(12,2),
  profit_amount DECIMAL(12,2),
  
  -- Status and approval
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'paid', 'cancelled', 'disputed', 'on_hold'
  )),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Payment tracking
  payout_id UUID, -- Link to commission_payouts
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Payout scheduling
  is_due_for_payout BOOLEAN DEFAULT false,
  payout_deadline DATE, -- Optional deadline for when commission should be paid
  payout_scheduled_date DATE, -- When the payout is scheduled to happen
  
  -- Pipeline stage tracking
  pipeline_stage_met BOOLEAN DEFAULT false, -- Has the required pipeline stage been reached?
  pipeline_stage_met_at TIMESTAMP WITH TIME ZONE, -- When the stage requirement was met
  current_pipeline_stage VARCHAR, -- Current stage of the opportunity
  
  -- Dispute handling
  is_disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Commission Splits - For splitting commissions between multiple people
CREATE TABLE IF NOT EXISTS commission_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID NOT NULL REFERENCES commission_records(id) ON DELETE CASCADE,
  
  -- Split recipient
  team_member_id UUID REFERENCES team_members(id),
  ghl_user_id VARCHAR,
  user_name VARCHAR,
  user_email VARCHAR,
  
  -- Split details
  split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_amount DECIMAL(12,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Commission Adjustments - Manual adjustments to commissions
CREATE TABLE IF NOT EXISTS commission_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_record_id UUID NOT NULL REFERENCES commission_records(id),
  
  -- Adjustment details
  adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
    'bonus', 'deduction', 'correction', 'clawback'
  )),
  adjustment_amount DECIMAL(12,2) NOT NULL, -- Positive for additions, negative for deductions
  adjustment_reason TEXT NOT NULL,
  
  -- Approval
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns to existing commission_calculations table if they don't exist
DO $$ 
BEGIN
  -- Add event_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'event_id') THEN
    ALTER TABLE commission_calculations ADD COLUMN event_id UUID REFERENCES commission_events(id);
  END IF;
  
  -- Add assignment_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'assignment_id') THEN
    ALTER TABLE commission_calculations ADD COLUMN assignment_id UUID REFERENCES commission_assignments(id);
  END IF;
  
  -- Add payout scheduling columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'is_due_for_payout') THEN
    ALTER TABLE commission_calculations ADD COLUMN is_due_for_payout BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'payout_deadline') THEN
    ALTER TABLE commission_calculations ADD COLUMN payout_deadline DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'payout_scheduled_date') THEN
    ALTER TABLE commission_calculations ADD COLUMN payout_scheduled_date DATE;
  END IF;
  
  -- Add pipeline stage tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'pipeline_stage_met') THEN
    ALTER TABLE commission_calculations ADD COLUMN pipeline_stage_met BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'pipeline_stage_met_at') THEN
    ALTER TABLE commission_calculations ADD COLUMN pipeline_stage_met_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_calculations' AND column_name = 'current_pipeline_stage') THEN
    ALTER TABLE commission_calculations ADD COLUMN current_pipeline_stage VARCHAR;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_events_org ON commission_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_opportunity ON commission_events(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_events_contact ON commission_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_date ON commission_events(event_date);
CREATE INDEX IF NOT EXISTS idx_commission_events_source_type ON commission_events(event_source, event_type);
CREATE INDEX IF NOT EXISTS idx_commission_events_opportunity_org ON commission_events(organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_commission_assignments_org ON commission_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_assignments_opportunity ON commission_assignments(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_assignments_team_member ON commission_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active ON commission_assignments(is_active, effective_date);

CREATE INDEX IF NOT EXISTS idx_commission_records_org ON commission_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_event ON commission_records(event_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_assignment ON commission_records(assignment_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_team_member ON commission_records(team_member_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_commission_records_payout ON commission_records(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_records_due_payout ON commission_records(is_due_for_payout, payout_deadline) WHERE is_due_for_payout = true;
CREATE INDEX IF NOT EXISTS idx_commission_records_payout_deadline ON commission_records(payout_deadline) WHERE payout_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_splits_record ON commission_splits(commission_record_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_org ON commission_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_record ON commission_adjustments(commission_record_id);

-- Also update commission_calculations indexes for payout tracking
CREATE INDEX IF NOT EXISTS idx_commission_calculations_due_payout ON commission_calculations(is_due_for_payout, payout_deadline) WHERE is_due_for_payout = true;
CREATE INDEX IF NOT EXISTS idx_commission_calculations_payout_deadline ON commission_calculations(payout_deadline) WHERE payout_deadline IS NOT NULL;

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_commission_events_updated_at 
  BEFORE UPDATE ON commission_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_assignments_updated_at 
  BEFORE UPDATE ON commission_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_records_updated_at 
  BEFORE UPDATE ON commission_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commission(
  p_event_id UUID,
  p_assignment_id UUID
) RETURNS TABLE (
  commission_amount DECIMAL(12,2),
  calculation_method VARCHAR(100),
  calculation_details JSONB
) AS $$
DECLARE
  v_event commission_events%ROWTYPE;
  v_assignment commission_assignments%ROWTYPE;
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(12,2);
  v_calculation_method VARCHAR(100);
  v_calculation_details JSONB;
BEGIN
  -- Get event and assignment details
  SELECT * INTO v_event FROM commission_events WHERE id = p_event_id;
  SELECT * INTO v_assignment FROM commission_assignments WHERE id = p_assignment_id;
  
  -- Determine commission rate based on event type
  v_commission_rate := v_assignment.base_rate;
  
  CASE v_event.event_type
    WHEN 'payment_collected' THEN
      v_commission_rate := COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate);
    WHEN 'estimate_sent' THEN
      v_commission_rate := COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate);
    WHEN 'invoice_paid' THEN
      v_commission_rate := COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate);
    WHEN 'opportunity_won' THEN
      v_commission_rate := COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate);
    ELSE
      v_commission_rate := v_assignment.base_rate;
  END CASE;
  
  -- Calculate commission based on type
  IF v_assignment.commission_type = 'percentage_gross' THEN
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'percentage_gross';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  ELSIF v_assignment.commission_type = 'fixed_amount' THEN
    v_commission_amount := v_assignment.fixed_amount;
    v_calculation_method := 'fixed_amount';
    v_calculation_details := jsonb_build_object(
      'fixed_amount', v_assignment.fixed_amount
    );
  ELSE
    -- Default to percentage gross
    v_commission_amount := v_event.event_amount * (v_commission_rate / 100);
    v_calculation_method := 'default_percentage';
    v_calculation_details := jsonb_build_object(
      'base_amount', v_event.event_amount,
      'rate', v_commission_rate,
      'formula', 'base_amount * rate / 100'
    );
  END IF;
  
  RETURN QUERY SELECT v_commission_amount, v_calculation_method, v_calculation_details;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create commission records when events occur
CREATE OR REPLACE FUNCTION process_commission_event()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_calc RECORD;
BEGIN
  -- Find applicable commission assignments
  FOR v_assignment IN
    SELECT * FROM commission_assignments
    WHERE organization_id = NEW.organization_id
      AND is_active = true
      AND effective_date <= CURRENT_DATE
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      AND (
        (assignment_type = 'opportunity' AND opportunity_id = NEW.opportunity_id) OR
        (assignment_type = 'global') OR
        (assignment_type = 'team_member' AND team_member_id IN (
          SELECT team_member_id FROM sales_transactions 
          WHERE opportunity_id = NEW.opportunity_id
          LIMIT 1
        ))
      )
    ORDER BY priority DESC
  LOOP
    -- Calculate commission
    SELECT * INTO v_calc FROM calculate_commission(NEW.id, v_assignment.id);
    
    -- Create commission record
    INSERT INTO commission_records (
      organization_id,
      event_id,
      assignment_id,
      team_member_id,
      ghl_user_id,
      user_name,
      user_email,
      base_amount,
      commission_rate,
      commission_amount,
      calculation_method,
      calculation_details,
      status
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      v_assignment.id,
      v_assignment.team_member_id,
      v_assignment.ghl_user_id,
      v_assignment.user_name,
      v_assignment.user_email,
      NEW.event_amount,
      CASE 
        WHEN v_assignment.commission_type LIKE 'percentage%' THEN
          CASE NEW.event_type
            WHEN 'payment_collected' THEN COALESCE(v_assignment.payment_collected_rate, v_assignment.base_rate)
            WHEN 'estimate_sent' THEN COALESCE(v_assignment.estimate_sent_rate, v_assignment.base_rate)
            WHEN 'invoice_paid' THEN COALESCE(v_assignment.invoice_paid_rate, v_assignment.base_rate)
            WHEN 'opportunity_won' THEN COALESCE(v_assignment.opportunity_won_rate, v_assignment.base_rate)
            ELSE v_assignment.base_rate
          END
        ELSE NULL
      END,
      v_calc.commission_amount,
      v_calc.calculation_method,
      v_calc.calculation_details,
      'pending'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process commissions when events are created
CREATE TRIGGER process_commission_on_event 
  AFTER INSERT ON commission_events
  FOR EACH ROW EXECUTE FUNCTION process_commission_event();

-- Function to update commission payout status based on approval and stage requirements
CREATE OR REPLACE FUNCTION update_commission_payout_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment commission_assignments%ROWTYPE;
  v_stage_required BOOLEAN := false;
BEGIN
  -- Get the assignment details to check for stage requirements
  SELECT * INTO v_assignment 
  FROM commission_assignments 
  WHERE id = NEW.assignment_id;
  
  -- Check if this assignment has pipeline stage requirements
  IF v_assignment.required_stage_id IS NOT NULL THEN
    v_stage_required := true;
  END IF;
  
  -- When a commission is approved, check if it can be marked as due for payout
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- If no stage requirement OR stage requirement is met, mark as due for payout
    IF NOT v_stage_required OR NEW.pipeline_stage_met = true THEN
      NEW.is_due_for_payout := true;
      -- Set default payout deadline to end of next month if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When pipeline stage requirement is met, check if commission should be due for payout
  IF NEW.pipeline_stage_met = true AND OLD.pipeline_stage_met = false THEN
    -- If commission is already approved, mark as due for payout
    IF NEW.status = 'approved' THEN
      NEW.is_due_for_payout := true;
      NEW.pipeline_stage_met_at := NOW();
      -- Set default payout deadline if not specified
      IF NEW.payout_deadline IS NULL THEN
        NEW.payout_deadline := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
      END IF;
    END IF;
  END IF;
  
  -- When a commission is paid, mark it as no longer due
  IF NEW.status = 'paid' THEN
    NEW.is_due_for_payout := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update payout status
CREATE TRIGGER update_payout_status_on_commission_change
  BEFORE UPDATE ON commission_records
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.pipeline_stage_met IS DISTINCT FROM NEW.pipeline_stage_met)
  EXECUTE FUNCTION update_commission_payout_status();

-- Also add the trigger to commission_calculations for backwards compatibility
CREATE TRIGGER update_payout_status_on_calculation_change
  BEFORE UPDATE ON commission_calculations
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.pipeline_stage_met IS DISTINCT FROM NEW.pipeline_stage_met)
  EXECUTE FUNCTION update_commission_payout_status();

-- Function to update commission records when opportunity stage changes
CREATE OR REPLACE FUNCTION update_commissions_on_stage_change(
  p_organization_id UUID,
  p_opportunity_id VARCHAR,
  p_pipeline_id VARCHAR,
  p_stage_id VARCHAR,
  p_stage_name VARCHAR
) RETURNS void AS $$
DECLARE
  v_commission RECORD;
  v_assignment commission_assignments%ROWTYPE;
BEGIN
  -- Find all commission records for this opportunity that are waiting for a stage
  FOR v_commission IN 
    SELECT cr.*, ca.required_stage_id, ca.required_pipeline_id, ca.stage_requirement_type
    FROM commission_records cr
    JOIN commission_assignments ca ON ca.id = cr.assignment_id
    JOIN commission_events ce ON ce.id = cr.event_id
    WHERE ce.organization_id = p_organization_id
      AND ce.opportunity_id = p_opportunity_id
      AND cr.pipeline_stage_met = false
      AND ca.required_stage_id IS NOT NULL
  LOOP
    -- Check if the stage requirement is met
    IF (v_commission.required_pipeline_id IS NULL OR v_commission.required_pipeline_id = p_pipeline_id)
       AND v_commission.required_stage_id = p_stage_id THEN
      -- Update the commission record
      UPDATE commission_records
      SET 
        pipeline_stage_met = true,
        pipeline_stage_met_at = NOW(),
        current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    ELSE
      -- Just update the current stage
      UPDATE commission_records
      SET current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    END IF;
  END LOOP;
  
  -- Also update commission_calculations for backwards compatibility
  FOR v_commission IN 
    SELECT cc.*, ca.required_stage_id, ca.required_pipeline_id, ca.stage_requirement_type
    FROM commission_calculations cc
    JOIN commission_assignments ca ON ca.id = cc.assignment_id
    WHERE cc.organization_id = p_organization_id
      AND cc.opportunity_id = p_opportunity_id
      AND cc.pipeline_stage_met = false
      AND ca.required_stage_id IS NOT NULL
  LOOP
    -- Check if the stage requirement is met
    IF (v_commission.required_pipeline_id IS NULL OR v_commission.required_pipeline_id = p_pipeline_id)
       AND v_commission.required_stage_id = p_stage_id THEN
      -- Update the commission calculation
      UPDATE commission_calculations
      SET 
        pipeline_stage_met = true,
        pipeline_stage_met_at = NOW(),
        current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    ELSE
      -- Just update the current stage
      UPDATE commission_calculations
      SET current_pipeline_stage = p_stage_name
      WHERE id = v_commission.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for opportunity commissions (for backwards compatibility)
CREATE OR REPLACE VIEW opportunity_commissions AS
SELECT 
  ca.id,
  ca.organization_id,
  ca.opportunity_id,
  ca.team_member_id,
  ca.ghl_user_id,
  ca.user_name,
  ca.user_email,
  CASE 
    WHEN ca.commission_type LIKE 'percentage%' THEN ca.commission_type
    ELSE 'custom'
  END as commission_type,
  ca.base_rate as commission_percentage,
  ca.notes,
  ca.created_at,
  ca.updated_at
FROM commission_assignments ca
WHERE ca.assignment_type = 'opportunity'
  AND ca.is_active = true;

-- Create view for commissions pending stage requirements
CREATE OR REPLACE VIEW commissions_pending_stage AS
SELECT 
  cr.id,
  cr.organization_id,
  ce.opportunity_id,
  cr.team_member_id,
  cr.user_name,
  cr.commission_amount,
  cr.status,
  cr.current_pipeline_stage,
  ca.required_pipeline_id,
  ca.required_stage_id,
  ca.required_stage_name,
  ca.stage_requirement_type,
  cr.pipeline_stage_met,
  cr.is_due_for_payout,
  cr.payout_deadline
FROM commission_records cr
JOIN commission_assignments ca ON ca.id = cr.assignment_id
JOIN commission_events ce ON ce.id = cr.event_id
WHERE ca.required_stage_id IS NOT NULL
  AND cr.pipeline_stage_met = false
  AND cr.status = 'approved';

-- Create view for commissions ready for payout
CREATE OR REPLACE VIEW commissions_ready_for_payout AS
SELECT 
  cr.id,
  cr.organization_id,
  cr.team_member_id,
  cr.user_name,
  cr.user_email,
  cr.commission_amount,
  cr.currency,
  ce.opportunity_id,
  ce.event_type,
  ce.event_date,
  cr.payout_deadline,
  cr.pipeline_stage_met,
  cr.pipeline_stage_met_at,
  cr.approved_at
FROM commission_records cr
JOIN commission_events ce ON ce.id = cr.event_id
WHERE cr.is_due_for_payout = true
  AND cr.status = 'approved'
  AND cr.payout_id IS NULL
ORDER BY cr.payout_deadline, cr.approved_at;

-- Create RLS policies
CREATE POLICY "Organization members can view commission data" ON commission_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_events.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can manage commission assignments" ON commission_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_assignments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view commission records" ON commission_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_records.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization members can view commission splits" ON commission_splits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM commission_records cr
      JOIN organization_members om ON om.organization_id = cr.organization_id
      WHERE cr.id = commission_splits.commission_record_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage commission adjustments" ON commission_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = commission_adjustments.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.role = 'owner' OR om.role = 'admin')
    )
  );