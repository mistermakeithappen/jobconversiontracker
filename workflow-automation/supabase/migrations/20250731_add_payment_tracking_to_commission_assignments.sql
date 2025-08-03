-- Add payment tracking columns to commission_assignments table

ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN commission_assignments.is_paid IS 'Whether this commission has been paid out';
COMMENT ON COLUMN commission_assignments.paid_date IS 'Date when the commission was paid';
COMMENT ON COLUMN commission_assignments.paid_amount IS 'Actual amount paid (may differ from calculated amount)';
COMMENT ON COLUMN commission_assignments.payment_reference IS 'Reference number for the payment (check number, transfer ID, etc)';

-- Create index for performance when filtering paid/unpaid commissions
CREATE INDEX IF NOT EXISTS idx_commission_assignments_paid_status 
ON commission_assignments(organization_id, is_paid, is_active)
WHERE is_active = true;