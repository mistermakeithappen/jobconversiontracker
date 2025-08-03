-- Add assigned_to field to opportunity_cache to track which GHL user is assigned to each opportunity
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- Create index for faster filtering by assigned user
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_assigned_to ON opportunity_cache(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_contact_assigned ON opportunity_cache(contact_id, assigned_to);

-- Update existing opportunities to set assigned_to from GHL data
-- This will need to be done during the next sync