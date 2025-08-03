-- Temporarily disable RLS on pipeline_stages for service role access
-- This is needed because we use service role with mock auth, so auth.uid() is null

ALTER TABLE pipeline_stages DISABLE ROW LEVEL SECURITY;