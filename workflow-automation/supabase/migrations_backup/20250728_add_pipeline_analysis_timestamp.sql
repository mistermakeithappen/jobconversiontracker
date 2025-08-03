-- Migration: Add pipeline analysis timestamp to integrations table
-- Created: 2025-07-28

-- Add last_pipeline_analysis column to track when pipeline analysis was last run
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS last_pipeline_analysis TIMESTAMPTZ;