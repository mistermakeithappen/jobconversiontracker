-- Add missing followers column to opportunity_cache table
-- This fixes the error: "Could not find the 'followers' column of 'opportunity_cache' in the schema cache"

-- Add followers field to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS followers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- Create index for faster follower lookups
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_followers 
ON opportunity_cache USING GIN (followers);

-- Add comment for documentation
COMMENT ON COLUMN opportunity_cache.followers IS 'Array of GHL user IDs who are following this opportunity';
COMMENT ON COLUMN opportunity_cache.followers_count IS 'Count of followers for this opportunity';
