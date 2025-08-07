-- Add assigned user fields to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);

-- Create index for assigned user lookups
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_assigned_to 
ON opportunity_cache(assigned_to) 
WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN opportunity_cache.assigned_to IS 'GHL user ID of the person assigned to this opportunity';
COMMENT ON COLUMN opportunity_cache.assigned_to_name IS 'Name of the person assigned to this opportunity';