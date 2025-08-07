-- Add pipeline_revenue_stages column to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS pipeline_revenue_stages JSONB;

-- Add comment explaining the new column
COMMENT ON COLUMN integrations.pipeline_revenue_stages IS 'JSON object mapping pipeline IDs to their revenue recognition stage IDs (first stage where revenue counts)';