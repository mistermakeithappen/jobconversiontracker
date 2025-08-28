-- 028_add_estimate_settings_column.sql
-- Add estimate_settings JSONB column to organizations table if it doesn't exist

-- Add estimate_settings column to organizations table
DO $$ 
BEGIN 
  -- Check if the column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'estimate_settings'
  ) THEN
    ALTER TABLE organizations ADD COLUMN estimate_settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN organizations.estimate_settings IS 'Settings for estimate generation including default terms, tax rates, etc.';
