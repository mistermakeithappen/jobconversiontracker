-- COMPLETE SCHEMA FIX
-- This script adds ALL missing columns and tables that are referenced in the codebase

-- ============================================================================
-- PART 1: Fix Missing Columns in Existing Tables
-- ============================================================================

-- Add missing columns to pipeline_stages table
ALTER TABLE pipeline_stages 
ADD COLUMN IF NOT EXISTS is_completion_stage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS commission_stage_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_stage_overridden_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS commission_stage_overridden_by UUID;

-- Add revenue recognition fields to pipeline_stages table
ALTER TABLE pipeline_stages 
ADD COLUMN IF NOT EXISTS is_revenue_recognition_stage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS revenue_stage_confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS revenue_stage_reasoning TEXT,
ADD COLUMN IF NOT EXISTS revenue_stage_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS revenue_stage_overridden_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS revenue_stage_overridden_by UUID;

-- Add pipeline mapping columns to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS pipeline_revenue_stages JSONB,
ADD COLUMN IF NOT EXISTS pipeline_completion_stages JSONB;

-- ============================================================================
-- PART 2: Create Missing Tables
-- ============================================================================

-- 1. Commission Assignments Table
CREATE TABLE IF NOT EXISTS commission_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- GHL User Information
    ghl_user_id VARCHAR(255) NOT NULL,
    ghl_user_name VARCHAR(255),
    ghl_user_email VARCHAR(255),
    
    -- Team Member Reference (if linked to internal team member)
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    
    -- Commission Configuration
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'tiered')),
    base_rate DECIMAL(5,2), -- For percentage or fixed amounts
    tier_config JSONB, -- For tiered commission structures
    
    -- Product/Pipeline Filters
    applies_to_products JSONB, -- Array of product IDs this applies to
    applies_to_pipelines JSONB, -- Array of pipeline IDs this applies to
    
    -- Status and Metadata
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Ensure unique assignment per user per organization
    UNIQUE(organization_id, ghl_user_id)
);

-- 2. Opportunity Commissions Table
CREATE TABLE IF NOT EXISTS opportunity_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    
    -- Opportunity Information
    opportunity_id VARCHAR(255) NOT NULL,
    contact_id VARCHAR(255),
    
    -- Commission Assignment Reference
    commission_assignment_id UUID REFERENCES commission_assignments(id) ON DELETE CASCADE,
    
    -- Team Member Information
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    ghl_user_id VARCHAR(255),
    
    -- Commission Calculation
    base_amount DECIMAL(10,2) NOT NULL, -- Sale amount
    commission_percentage DECIMAL(5,2),
    commission_amount DECIMAL(10,2) NOT NULL,
    commission_type VARCHAR(50),
    
    -- Status and Eligibility
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    is_eligible_for_payout BOOLEAN DEFAULT false,
    eligibility_checked_at TIMESTAMP WITH TIME ZONE,
    stage_at_eligibility VARCHAR(255),
    
    -- Payment Information
    payout_id UUID REFERENCES commission_payouts(id) ON DELETE SET NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique commission per opportunity per team member
    UNIQUE(organization_id, opportunity_id, team_member_id)
);

-- 3. Commission Eligibility Log Table
CREATE TABLE IF NOT EXISTS commission_eligibility_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Commission Reference
    opportunity_commission_id UUID REFERENCES opportunity_commissions(id) ON DELETE CASCADE,
    opportunity_id VARCHAR(255) NOT NULL,
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    
    -- Eligibility Check Details
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('stage_change', 'manual_review', 'automated')),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- Stage Information
    current_stage VARCHAR(255),
    stage_position INTEGER,
    is_completion_stage BOOLEAN,
    
    -- Decision Details
    is_eligible BOOLEAN NOT NULL,
    eligibility_reason TEXT,
    checked_by UUID REFERENCES users(id),
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PART 3: Add Indexes for Performance
-- ============================================================================

-- Pipeline stages indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_revenue_recognition 
ON pipeline_stages(ghl_pipeline_id, is_revenue_recognition_stage) 
WHERE is_revenue_recognition_stage = true;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_completion 
ON pipeline_stages(ghl_pipeline_id, is_completion_stage) 
WHERE is_completion_stage = true;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_integration 
ON pipeline_stages(organization_id, integration_id);

-- Commission assignments indexes
CREATE INDEX IF NOT EXISTS idx_commission_assignments_org_user 
ON commission_assignments(organization_id, ghl_user_id);

CREATE INDEX IF NOT EXISTS idx_commission_assignments_team_member 
ON commission_assignments(team_member_id) WHERE team_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_assignments_active 
ON commission_assignments(organization_id, is_active) WHERE is_active = true;

-- Opportunity commissions indexes
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_org_opp 
ON opportunity_commissions(organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_team_member 
ON opportunity_commissions(team_member_id) WHERE team_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_status 
ON opportunity_commissions(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_eligibility 
ON opportunity_commissions(organization_id, is_eligible_for_payout) 
WHERE is_eligible_for_payout = true;

-- Commission eligibility log indexes
CREATE INDEX IF NOT EXISTS idx_commission_eligibility_log_opp 
ON commission_eligibility_log(opportunity_commission_id);

CREATE INDEX IF NOT EXISTS idx_commission_eligibility_log_org_opp 
ON commission_eligibility_log(organization_id, opportunity_id);

-- ============================================================================
-- PART 4: Add Comments for Documentation
-- ============================================================================

-- Pipeline stages comments
COMMENT ON COLUMN pipeline_stages.is_completion_stage IS 'Indicates if this is the stage where commissions are due (project completion)';
COMMENT ON COLUMN pipeline_stages.ai_confidence_score IS 'AI confidence score for commission stage detection (0.00 to 1.00)';
COMMENT ON COLUMN pipeline_stages.ai_reasoning IS 'AI reasoning for why this stage is/is not a commission stage';
COMMENT ON COLUMN pipeline_stages.commission_stage_override IS 'Whether the commission stage status has been manually overridden';
COMMENT ON COLUMN pipeline_stages.commission_stage_overridden_at IS 'When the commission stage status was manually overridden';
COMMENT ON COLUMN pipeline_stages.commission_stage_overridden_by IS 'User who manually overridden the commission stage status';

COMMENT ON COLUMN pipeline_stages.is_revenue_recognition_stage IS 'Indicates if this is the first stage where revenue should be counted (AI-determined or manually overridden)';
COMMENT ON COLUMN pipeline_stages.revenue_stage_confidence_score IS 'AI confidence score for revenue recognition stage detection (0.00 to 1.00)';
COMMENT ON COLUMN pipeline_stages.revenue_stage_reasoning IS 'AI reasoning for why this stage is/is not a revenue recognition stage';
COMMENT ON COLUMN pipeline_stages.revenue_stage_override IS 'Whether the revenue recognition status has been manually overridden';
COMMENT ON COLUMN pipeline_stages.revenue_stage_overridden_at IS 'When the revenue recognition status was manually overridden';
COMMENT ON COLUMN pipeline_stages.revenue_stage_overridden_by IS 'User who manually overridden the revenue recognition status';

-- Integrations comments
COMMENT ON COLUMN integrations.pipeline_revenue_stages IS 'JSON object mapping pipeline IDs to their revenue recognition stage IDs (first stage where revenue counts)';
COMMENT ON COLUMN integrations.pipeline_completion_stages IS 'JSON object mapping pipeline IDs to their completion/commission stage IDs (where commissions are due)';

-- Table comments
COMMENT ON TABLE commission_assignments IS 'Assigns commission structures to GHL users/team members';
COMMENT ON TABLE opportunity_commissions IS 'Tracks commission calculations for specific opportunities';
COMMENT ON TABLE commission_eligibility_log IS 'Logs commission eligibility checks and status changes';

-- ============================================================================
-- PART 5: Verification Queries
-- ============================================================================

-- Verify pipeline_stages columns
SELECT 'pipeline_stages columns' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'pipeline_stages' 
AND column_name IN (
  'is_completion_stage', 'ai_confidence_score', 'ai_reasoning', 
  'commission_stage_override', 'commission_stage_overridden_at', 'commission_stage_overridden_by',
  'is_revenue_recognition_stage', 'revenue_stage_confidence_score', 'revenue_stage_reasoning',
  'revenue_stage_override', 'revenue_stage_overridden_at', 'revenue_stage_overridden_by'
)
ORDER BY column_name;

-- Verify integrations columns
SELECT 'integrations columns' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name IN ('pipeline_revenue_stages', 'pipeline_completion_stages')
ORDER BY column_name;

-- Verify new tables exist
SELECT 'table_existence' as check_type, table_name, 'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('commission_assignments', 'opportunity_commissions', 'commission_eligibility_log')
ORDER BY table_name;

-- Show table row counts (should be 0 for new tables)
SELECT 
  'commission_assignments' as table_name, 
  COUNT(*) as row_count 
FROM commission_assignments
UNION ALL
SELECT 
  'opportunity_commissions' as table_name, 
  COUNT(*) as row_count 
FROM opportunity_commissions
UNION ALL
SELECT 
  'commission_eligibility_log' as table_name, 
  COUNT(*) as row_count 
FROM commission_eligibility_log;
