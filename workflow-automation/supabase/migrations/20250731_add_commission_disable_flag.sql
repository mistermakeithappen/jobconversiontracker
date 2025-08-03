-- Add is_disabled flag to commission_assignments to allow disabling commission while keeping assignment
ALTER TABLE commission_assignments 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN commission_assignments.is_disabled IS 'When true, commission is assigned but disabled (0% rate) for this specific opportunity';

-- Create index for efficient querying of active, non-disabled commissions
CREATE INDEX IF NOT EXISTS idx_commission_assignments_active_not_disabled 
ON commission_assignments(organization_id, opportunity_id, is_active, is_disabled) 
WHERE is_active = true AND is_disabled = false;