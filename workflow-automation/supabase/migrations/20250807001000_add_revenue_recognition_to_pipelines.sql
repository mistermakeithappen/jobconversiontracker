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

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_revenue_recognition 
ON pipeline_stages(ghl_pipeline_id, is_revenue_recognition_stage) 
WHERE is_revenue_recognition_stage = true;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_completion 
ON pipeline_stages(ghl_pipeline_id, is_completion_stage) 
WHERE is_completion_stage = true;