-- Add origin tracking to contacts table for bidirectional sync
-- This allows us to know if a contact was created locally or synced from GHL

-- Add origin field to track where contact was created
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'ghl' CHECK (origin IN ('ghl', 'local', 'manual'));

-- Add flag to indicate if contact needs to be synced to GHL
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS needs_ghl_sync BOOLEAN DEFAULT FALSE;

-- Add GHL sync attempt tracking
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS ghl_sync_attempts INTEGER DEFAULT 0;

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS last_ghl_sync_error TEXT;

-- Create index for finding contacts that need to be synced to GHL
CREATE INDEX IF NOT EXISTS idx_contacts_needs_ghl_sync 
ON contacts(needs_ghl_sync) 
WHERE needs_ghl_sync = TRUE;

-- Update existing contacts to mark them as from GHL (since they were synced)
UPDATE contacts 
SET origin = 'ghl' 
WHERE ghl_contact_id IS NOT NULL AND origin IS NULL;

-- Comment on the new columns
COMMENT ON COLUMN contacts.origin IS 'Source of the contact: ghl (synced from GoHighLevel), local (created in app), manual (manually imported)';
COMMENT ON COLUMN contacts.needs_ghl_sync IS 'Flag indicating if this contact needs to be synced to GoHighLevel';
COMMENT ON COLUMN contacts.ghl_sync_attempts IS 'Number of times we tried to sync this contact to GHL';
COMMENT ON COLUMN contacts.last_ghl_sync_error IS 'Last error message when trying to sync to GHL';