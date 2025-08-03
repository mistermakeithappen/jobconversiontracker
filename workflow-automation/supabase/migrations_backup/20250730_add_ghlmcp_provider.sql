-- Add ghlmcp provider to user_api_keys table
-- This allows storing GoHighLevel MCP Private Integration Tokens

DO $$
BEGIN
    -- Drop the existing provider constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_api_keys_provider_check'
        AND table_name = 'user_api_keys'
    ) THEN
        ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
        RAISE NOTICE 'Dropped existing provider constraint';
    END IF;
    
    -- Add updated constraint that includes ghlmcp
    ALTER TABLE user_api_keys 
    ADD CONSTRAINT user_api_keys_provider_check 
    CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'notion', 'ghlmcp'));
    
    RAISE NOTICE 'Added ghlmcp to allowed providers';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update provider constraint: %', SQLERRM;
END $$;

-- Update the comment to reflect the new provider
COMMENT ON COLUMN user_api_keys.provider IS 'Service provider: openai, anthropic, google, azure, notion, ghlmcp';