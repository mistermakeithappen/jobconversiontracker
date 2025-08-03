-- Add reference to user_api_keys for MCP tokens
-- This allows MCP tokens to be stored in the centralized API keys table

-- Add column to integrations table to reference user_api_keys
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS mcp_api_key_id UUID;

-- Add foreign key constraint to user_api_keys table
-- Note: We don't add CASCADE DELETE because we want to handle cleanup manually
ALTER TABLE integrations 
ADD CONSTRAINT IF NOT EXISTS integrations_mcp_api_key_id_fkey 
FOREIGN KEY (mcp_api_key_id) REFERENCES user_api_keys(id);

-- Update provider constraint to include ghl_mcp
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_api_keys_provider_check'
        AND table_name = 'user_api_keys'
    ) THEN
        ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
    END IF;
    
    -- Add updated constraint to include ghl_mcp
    ALTER TABLE user_api_keys 
    ADD CONSTRAINT user_api_keys_provider_check 
    CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghl_mcp'));
    
    RAISE NOTICE 'Updated provider constraint to include ghl_mcp';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update provider constraint: %', SQLERRM;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN integrations.mcp_api_key_id IS 'Reference to user_api_keys table for MCP authentication token';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_integrations_mcp_api_key_id ON integrations(mcp_api_key_id);

-- Migration complete
COMMENT ON TABLE integrations IS 'Integration configurations with MCP token references to user_api_keys table';