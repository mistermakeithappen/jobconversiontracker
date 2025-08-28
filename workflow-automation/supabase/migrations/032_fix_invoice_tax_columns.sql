-- 032_fix_invoice_tax_columns.sql
-- Add missing tax and property columns to invoices table

-- Add property and tax columns to ghl_invoices table
ALTER TABLE ghl_invoices 
ADD COLUMN IF NOT EXISTS property_id UUID,
ADD COLUMN IF NOT EXISTS property_address TEXT,
ADD COLUMN IF NOT EXISTS applied_tax_rate DECIMAL(5,4) DEFAULT 0;

-- Add property and tax columns to ghl_estimates table (if not already present)
ALTER TABLE ghl_estimates 
ADD COLUMN IF NOT EXISTS property_id UUID,
ADD COLUMN IF NOT EXISTS property_address TEXT,
ADD COLUMN IF NOT EXISTS applied_tax_rate DECIMAL(5,4) DEFAULT 0;

-- Add foreign key constraints if properties table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'properties') THEN
    -- Add foreign key constraint for invoices (ignore if already exists)
    BEGIN
      ALTER TABLE ghl_invoices 
      ADD CONSTRAINT fk_ghl_invoices_property 
      FOREIGN KEY (property_id) REFERENCES properties(id);
    EXCEPTION
      WHEN duplicate_object THEN 
        -- Constraint already exists, do nothing
        NULL;
    END;
    
    -- Add foreign key constraint for estimates (ignore if already exists)
    BEGIN
      ALTER TABLE ghl_estimates 
      ADD CONSTRAINT fk_ghl_estimates_property 
      FOREIGN KEY (property_id) REFERENCES properties(id);
    EXCEPTION
      WHEN duplicate_object THEN 
        -- Constraint already exists, do nothing
        NULL;
    END;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ghl_invoices_property ON ghl_invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_ghl_estimates_property ON ghl_estimates(property_id);

-- Add comments to document the columns
COMMENT ON COLUMN ghl_invoices.property_id IS 'Reference to the property this invoice is for';
COMMENT ON COLUMN ghl_invoices.property_address IS 'Denormalized property address for historical accuracy';
COMMENT ON COLUMN ghl_invoices.applied_tax_rate IS 'Tax rate applied to this invoice (stored as decimal, e.g., 0.0825 for 8.25%)';

COMMENT ON COLUMN ghl_estimates.property_id IS 'Reference to the property this estimate is for';
COMMENT ON COLUMN ghl_estimates.property_address IS 'Denormalized property address for historical accuracy';
COMMENT ON COLUMN ghl_estimates.applied_tax_rate IS 'Tax rate applied to this estimate (stored as decimal, e.g., 0.0825 for 8.25%)';
