-- Add assigned user columns to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);

-- Create index for assigned_to for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_assigned_to 
ON opportunity_cache(assigned_to) 
WHERE assigned_to IS NOT NULL;