-- 025_add_company_logo.sql
-- Adds company logo URL field to organizations table for use in estimates, invoices, and other documents

-- Add company_logo_url field to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_phone TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN organizations.company_logo_url IS 'URL to the company logo image for use in estimates and invoices';
COMMENT ON COLUMN organizations.company_name IS 'Legal company name for official documents';
COMMENT ON COLUMN organizations.company_address IS 'Company address for estimates and invoices';
COMMENT ON COLUMN organizations.company_phone IS 'Company phone number for customer contact';
COMMENT ON COLUMN organizations.company_email IS 'Company email for customer correspondence';