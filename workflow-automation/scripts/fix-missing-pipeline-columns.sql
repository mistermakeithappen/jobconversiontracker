-- Fix Missing Pipeline Schema Columns
-- This script adds all missing columns that are referenced in the codebase but missing from the current database

-- ============================================================================
-- 1. Add missing columns to pipeline_stages table
-- ============================================================================

-- Add commission/completion stage fields to pipeline_stages table
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

-- ============================================================================
-- 2. Add missing columns to integrations table
-- ============================================================================

-- Add pipeline mapping columns to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS pipeline_revenue_stages JSONB,
ADD COLUMN IF NOT EXISTS pipeline_completion_stages JSONB;

-- ============================================================================
-- 3. Add helpful comments explaining the columns
-- ============================================================================

-- Add comments explaining the commission/completion columns
COMMENT ON COLUMN pipeline_stages.is_completion_stage IS 'Indicates if this is the stage where commissions are due (project completion)';
COMMENT ON COLUMN pipeline_stages.ai_confidence_score IS 'AI confidence score for commission stage detection (0.00 to 1.00)';
COMMENT ON COLUMN pipeline_stages.ai_reasoning IS 'AI reasoning for why this stage is/is not a commission stage';
COMMENT ON COLUMN pipeline_stages.commission_stage_override IS 'Whether the commission stage status has been manually overridden';
COMMENT ON COLUMN pipeline_stages.commission_stage_overridden_at IS 'When the commission stage status was manually overridden';
COMMENT ON COLUMN pipeline_stages.commission_stage_overridden_by IS 'User who manually overridden the commission stage status';

-- Add comments explaining the revenue recognition columns
COMMENT ON COLUMN pipeline_stages.is_revenue_recognition_stage IS 'Indicates if this is the first stage where revenue should be counted (AI-determined or manually overridden)';
COMMENT ON COLUMN pipeline_stages.revenue_stage_confidence_score IS 'AI confidence score for revenue recognition stage detection (0.00 to 1.00)';
COMMENT ON COLUMN pipeline_stages.revenue_stage_reasoning IS 'AI reasoning for why this stage is/is not a revenue recognition stage';
COMMENT ON COLUMN pipeline_stages.revenue_stage_override IS 'Whether the revenue recognition status has been manually overridden';
COMMENT ON COLUMN pipeline_stages.revenue_stage_overridden_at IS 'When the revenue recognition status was manually overridden';
COMMENT ON COLUMN pipeline_stages.revenue_stage_overridden_by IS 'User who manually overridden the revenue recognition status';

-- Add comments explaining the integrations columns
COMMENT ON COLUMN integrations.pipeline_revenue_stages IS 'JSON object mapping pipeline IDs to their revenue recognition stage IDs (first stage where revenue counts)';
COMMENT ON COLUMN integrations.pipeline_completion_stages IS 'JSON object mapping pipeline IDs to their completion/commission stage IDs (where commissions are due)';

-- ============================================================================
-- 4. Add indexes for better query performance
-- ============================================================================

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_revenue_recognition 
ON pipeline_stages(ghl_pipeline_id, is_revenue_recognition_stage) 
WHERE is_revenue_recognition_stage = true;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_completion 
ON pipeline_stages(ghl_pipeline_id, is_completion_stage) 
WHERE is_completion_stage = true;

-- Add index for organization + integration lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_integration 
ON pipeline_stages(organization_id, integration_id);

-- ============================================================================
-- 5. Verification queries to confirm columns were added
-- ============================================================================

-- Verify the columns were added to pipeline_stages
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'pipeline_stages' 
AND column_name IN (
  'is_completion_stage', 'ai_confidence_score', 'ai_reasoning', 
  'commission_stage_override', 'commission_stage_overridden_at', 'commission_stage_overridden_by',
  'is_revenue_recognition_stage', 'revenue_stage_confidence_score', 'revenue_stage_reasoning',
  'revenue_stage_override', 'revenue_stage_overridden_at', 'revenue_stage_overridden_by'
)
ORDER BY column_name;

-- Verify the columns were added to integrations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'integrations' 
AND column_name IN (
  'pipeline_revenue_stages', 'pipeline_completion_stages'
)
ORDER BY column_name;

-- Show current pipeline_stages table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'pipeline_stages' 
ORDER BY ordinal_position;
