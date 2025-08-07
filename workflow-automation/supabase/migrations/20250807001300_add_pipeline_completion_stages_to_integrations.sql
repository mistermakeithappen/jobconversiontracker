-- Add pipeline_completion_stages column to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS pipeline_completion_stages JSONB;

-- Add comment explaining the new column
COMMENT ON COLUMN integrations.pipeline_completion_stages IS 'JSON object mapping pipeline IDs to their completion/commission stage IDs (where commissions are due)';