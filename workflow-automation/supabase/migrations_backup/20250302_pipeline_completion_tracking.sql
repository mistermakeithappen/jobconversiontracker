-- Add pipeline completion stage tracking for commission eligibility

-- 1. Add completion stage tracking to integrations
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS pipeline_completion_stages JSONB DEFAULT '{}';

-- Structure: { "pipeline_id": "stage_id", ... }
COMMENT ON COLUMN integrations.pipeline_completion_stages IS 'Maps pipeline IDs to their completion stage IDs for commission tracking';

-- 2. Create pipeline_stages table to cache pipeline/stage information
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  pipeline_id VARCHAR NOT NULL,
  pipeline_name VARCHAR NOT NULL,
  stage_id VARCHAR NOT NULL,
  stage_name VARCHAR NOT NULL,
  stage_position INTEGER,
  is_completion_stage BOOLEAN DEFAULT false,
  ai_confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  ai_reasoning TEXT,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, pipeline_id, stage_id)
);

-- 3. Add commission eligibility tracking to opportunities
ALTER TABLE opportunity_commissions ADD COLUMN IF NOT EXISTS is_eligible_for_payout BOOLEAN DEFAULT false;
ALTER TABLE opportunity_commissions ADD COLUMN IF NOT EXISTS eligibility_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunity_commissions ADD COLUMN IF NOT EXISTS stage_at_eligibility VARCHAR;

-- 4. Create commission eligibility log
CREATE TABLE IF NOT EXISTS commission_eligibility_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id VARCHAR NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  previous_stage_id VARCHAR,
  new_stage_id VARCHAR,
  previous_stage_name VARCHAR,
  new_stage_name VARCHAR,
  became_eligible BOOLEAN DEFAULT false,
  commission_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create function to check commission eligibility
CREATE OR REPLACE FUNCTION check_commission_eligibility(
  p_opportunity_id VARCHAR,
  p_pipeline_id VARCHAR,
  p_stage_id VARCHAR,
  p_integration_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_completion_stage BOOLEAN;
  v_completion_stage_id VARCHAR;
BEGIN
  -- Get the completion stage for this pipeline
  SELECT (pipeline_completion_stages->p_pipeline_id)::VARCHAR INTO v_completion_stage_id
  FROM integrations
  WHERE id = p_integration_id;
  
  -- Check if current stage is the completion stage
  v_is_completion_stage := (v_completion_stage_id = p_stage_id);
  
  -- If eligible, update opportunity commissions
  IF v_is_completion_stage THEN
    UPDATE opportunity_commissions
    SET 
      is_eligible_for_payout = true,
      eligibility_checked_at = NOW(),
      stage_at_eligibility = p_stage_id
    WHERE opportunity_id = p_opportunity_id
      AND NOT is_eligible_for_payout; -- Only update if not already eligible
  END IF;
  
  RETURN v_is_completion_stage;
END;
$$ LANGUAGE plpgsql;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_integration_pipeline ON pipeline_stages(integration_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_completion ON pipeline_stages(is_completion_stage);
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_eligibility ON opportunity_commissions(is_eligible_for_payout);
CREATE INDEX IF NOT EXISTS idx_commission_eligibility_log_opportunity ON commission_eligibility_log(opportunity_id);

-- 7. Create triggers
CREATE TRIGGER update_pipeline_stages_updated_at 
    BEFORE UPDATE ON pipeline_stages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_eligibility_log ENABLE ROW LEVEL SECURITY;

-- 9. Create policies
CREATE POLICY "Users can view their own pipeline stages" ON pipeline_stages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pipeline stages" ON pipeline_stages
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their commission eligibility logs" ON commission_eligibility_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM integrations 
            WHERE id = commission_eligibility_log.integration_id 
            AND user_id = auth.uid()
        )
    );

-- 10. Add helpful comments
COMMENT ON TABLE pipeline_stages IS 'Caches GHL pipeline and stage information with AI-analyzed completion stages';
COMMENT ON COLUMN pipeline_stages.is_completion_stage IS 'Whether AI identified this as a completion/won stage';
COMMENT ON COLUMN pipeline_stages.ai_confidence_score IS 'AI confidence in stage classification (0-1)';
COMMENT ON TABLE commission_eligibility_log IS 'Tracks when opportunities become eligible for commission payouts';