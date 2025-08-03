-- Add metadata column to integrations table for storing integration-specific data
-- This includes location_id, company_id, and other important GHL settings

-- Add metadata column if it doesn't exist
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment explaining the metadata structure
COMMENT ON COLUMN integrations.metadata IS 'Integration-specific metadata (e.g., location_id, company_id for GoHighLevel)';

-- Create index on metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_integrations_metadata ON integrations USING gin(metadata);

-- Update existing GoHighLevel integrations to extract location_id from tokens if available
UPDATE integrations 
SET metadata = 
  CASE 
    WHEN provider = 'gohighlevel' AND tokens IS NOT NULL THEN
      jsonb_build_object(
        'location_id', 
        CASE 
          WHEN tokens::text LIKE '%locationId%' THEN 
            (pgp_sym_decrypt(decode(tokens, 'base64'), current_setting('app.encryption_key'))::jsonb->>'locationId')
          ELSE NULL
        END,
        'company_id',
        CASE 
          WHEN tokens::text LIKE '%companyId%' THEN 
            (pgp_sym_decrypt(decode(tokens, 'base64'), current_setting('app.encryption_key'))::jsonb->>'companyId')
          ELSE NULL
        END,
        'updated_at', now()
      )
    ELSE metadata
  END
WHERE provider = 'gohighlevel' AND (metadata IS NULL OR metadata = '{}');

-- Add helper function to get integration metadata
CREATE OR REPLACE FUNCTION get_integration_metadata(
  p_user_id UUID,
  p_provider TEXT
) RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT metadata 
    FROM integrations 
    WHERE user_id = p_user_id 
      AND provider = p_provider 
      AND is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to update integration metadata
CREATE OR REPLACE FUNCTION update_integration_metadata(
  p_user_id UUID,
  p_provider TEXT,
  p_metadata JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE integrations 
  SET 
    metadata = metadata || p_metadata,
    updated_at = now()
  WHERE user_id = p_user_id 
    AND provider = p_provider 
    AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_integration_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION update_integration_metadata TO authenticated;