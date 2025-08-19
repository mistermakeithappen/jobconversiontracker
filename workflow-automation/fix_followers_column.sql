-- Fix for "Could not find the 'followers' column of 'opportunity_cache' in the schema cache"
-- Run this in your Supabase Dashboard SQL Editor

-- Step 1: Add the missing followers columns
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS followers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_followers 
ON opportunity_cache USING GIN (followers);

-- Step 3: Add helpful comments
COMMENT ON COLUMN opportunity_cache.followers IS 'Array of GHL user IDs who are following this opportunity';
COMMENT ON COLUMN opportunity_cache.followers_count IS 'Count of followers for this opportunity';

-- Step 4: Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'opportunity_cache' 
  AND column_name IN ('followers', 'followers_count')
ORDER BY column_name;

-- Step 5: Show the current table structure
\d opportunity_cache;
