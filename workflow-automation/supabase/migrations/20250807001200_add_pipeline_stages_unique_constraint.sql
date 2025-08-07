-- Add unique constraint for pipeline stages to enable proper upsert operations
-- First drop the constraint if it exists, then recreate it
ALTER TABLE pipeline_stages 
DROP CONSTRAINT IF EXISTS pipeline_stages_unique_key;

ALTER TABLE pipeline_stages 
ADD CONSTRAINT pipeline_stages_unique_key 
UNIQUE (organization_id, integration_id, ghl_pipeline_id, ghl_stage_id);