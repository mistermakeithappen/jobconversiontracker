-- 031_add_invoice_settings_column.sql
-- Add invoice_settings JSONB column to organizations table

-- Add invoice_settings column to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT '{
  "default_payment_terms": "Net 30",
  "default_notes": "Thank you for your business. Payment is due within 30 days.",
  "default_tax_rate": 8.25,
  "default_due_days": 30
}';

-- Add comment to document the column
COMMENT ON COLUMN organizations.invoice_settings IS 'Settings for invoice generation including default payment terms, tax rates, due dates, etc.';
