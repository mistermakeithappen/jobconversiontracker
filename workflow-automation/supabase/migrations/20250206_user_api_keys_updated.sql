-- User API Keys Management System (Updated)
-- This migration creates secure storage for user-provided API keys with Notion support

-- Create table for user API keys with encryption
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'notion', etc.
  encrypted_key TEXT NOT NULL,
  key_name VARCHAR(255), -- Optional friendly name for the key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Constraints
  UNIQUE(user_id, provider, key_name),
  CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion'))
);

-- Add foreign key constraint to auth.users if possible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- Add foreign key to auth.users if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'user_api_keys_user_id_fkey'
        ) THEN
            ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        RAISE NOTICE 'auth.users table not found - skipping user_id foreign key constraint';
    END IF;
END $$;

-- Add RLS policies
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Users can manage their own API keys" ON user_api_keys;
CREATE POLICY "Users can manage their own API keys" ON user_api_keys
  FOR ALL USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active) WHERE is_active = TRUE;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER trigger_update_user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_user_api_keys_updated_at();

-- Function to update last_used_at when key is accessed
CREATE OR REPLACE FUNCTION mark_api_key_used(key_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_api_keys 
  SET last_used_at = NOW() 
  WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON user_api_keys TO authenticated;
GRANT EXECUTE ON FUNCTION mark_api_key_used(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_api_keys_updated_at() TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE user_api_keys IS 'Stores encrypted user API keys for various AI providers and services';
COMMENT ON COLUMN user_api_keys.encrypted_key IS 'API key encrypted using AES-256-GCM with application encryption key';
COMMENT ON COLUMN user_api_keys.provider IS 'Service provider: openai, anthropic, google, azure, notion';
COMMENT ON COLUMN user_api_keys.key_name IS 'Optional friendly name to help users identify their keys';

-- Update existing constraint if table already exists
DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_api_keys_provider_check'
    ) THEN
        ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
    END IF;
    
    -- Add updated constraint
    ALTER TABLE user_api_keys 
    ADD CONSTRAINT user_api_keys_provider_check 
    CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion'));
    
    RAISE NOTICE 'Updated provider constraint to include notion';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update provider constraint: %', SQLERRM;
END $$;