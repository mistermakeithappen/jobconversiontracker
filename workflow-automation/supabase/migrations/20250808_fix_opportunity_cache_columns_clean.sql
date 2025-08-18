-- Add missing columns to opportunity_cache table if they don't exist
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS pipeline_id VARCHAR(255);

ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS pipeline_name VARCHAR(255);

ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS ghl_updated_at TIMESTAMPTZ;

ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for pipeline_id for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_pipeline_id 
ON opportunity_cache(pipeline_id) 
WHERE pipeline_id IS NOT NULL;

-- Update the comment on the table
COMMENT ON TABLE opportunity_cache IS 'Cache of GHL opportunities for faster lookups with calculated metrics';