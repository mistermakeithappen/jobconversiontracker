-- Add is_disabled column to commission_assignments table
-- This allows temporarily disabling a commission assignment without deleting it

ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN commission_assignments.is_disabled IS 'Whether this commission assignment is temporarily disabled';

-- Create index for performance when filtering active assignments
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active 
ON commission_assignments(organization_id, opportunity_id, is_active, is_disabled)
WHERE is_active = true AND (is_disabled IS NULL OR is_disabled = false);