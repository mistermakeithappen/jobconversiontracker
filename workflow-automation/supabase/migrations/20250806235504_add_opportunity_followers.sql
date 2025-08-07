-- 20250806235504_add_opportunity_followers.sql
-- Add support for opportunity followers and their commission assignments

-- 1. Add followers field to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS followers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- 2. Add assignment_role field to commission_assignments table
ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS assignment_role VARCHAR(20) DEFAULT 'primary' 
  CHECK (assignment_role IN ('primary', 'follower', 'split', 'override'));

-- 3. Add follower-specific commission settings
ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS follower_rate_adjustment DECIMAL(5,2) DEFAULT 100.00
  CHECK (follower_rate_adjustment >= 0 AND follower_rate_adjustment <= 100),
ADD COLUMN IF NOT EXISTS parent_assignment_id UUID REFERENCES commission_assignments(id) ON DELETE CASCADE;

-- 4. Add index for faster follower lookups
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_followers 
ON opportunity_cache USING GIN (followers);

CREATE INDEX IF NOT EXISTS idx_commission_assignments_role 
ON commission_assignments(assignment_role) 
WHERE assignment_role != 'primary';

CREATE INDEX IF NOT EXISTS idx_commission_assignments_parent 
ON commission_assignments(parent_assignment_id) 
WHERE parent_assignment_id IS NOT NULL;

-- 5. Create a function to extract follower IDs from JSONB array
CREATE OR REPLACE FUNCTION get_opportunity_followers(p_opportunity_id VARCHAR(255), p_organization_id UUID)
RETURNS TABLE(follower_id VARCHAR(255)) AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_array_elements_text(followers) AS follower_id
  FROM opportunity_cache
  WHERE opportunity_id = p_opportunity_id 
  AND organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a view for commission summary including followers
CREATE OR REPLACE VIEW opportunity_commission_summary AS
SELECT 
  ca.opportunity_id,
  ca.organization_id,
  COUNT(CASE WHEN ca.assignment_role = 'primary' THEN 1 END) as primary_assignees,
  COUNT(CASE WHEN ca.assignment_role = 'follower' THEN 1 END) as follower_assignees,
  SUM(CASE WHEN ca.assignment_role = 'primary' THEN 
    CASE 
      WHEN ca.commission_type = 'percentage_gross' THEN oc.monetary_value * ca.base_rate / 100
      WHEN ca.commission_type = 'percentage_profit' THEN GREATEST(0, oc.monetary_value - oc.total_expenses) * ca.base_rate / 100
      ELSE 0
    END
  END) as primary_commission_total,
  SUM(CASE WHEN ca.assignment_role = 'follower' THEN 
    CASE 
      WHEN ca.commission_type = 'percentage_gross' THEN oc.monetary_value * ca.base_rate * ca.follower_rate_adjustment / 10000
      WHEN ca.commission_type = 'percentage_profit' THEN GREATEST(0, oc.monetary_value - oc.total_expenses) * ca.base_rate * ca.follower_rate_adjustment / 10000
      ELSE 0
    END
  END) as follower_commission_total,
  SUM(
    CASE 
      WHEN ca.commission_type = 'percentage_gross' THEN 
        oc.monetary_value * ca.base_rate * 
        (CASE WHEN ca.assignment_role = 'follower' THEN ca.follower_rate_adjustment / 100 ELSE 1 END) / 100
      WHEN ca.commission_type = 'percentage_profit' THEN 
        GREATEST(0, oc.monetary_value - oc.total_expenses) * ca.base_rate * 
        (CASE WHEN ca.assignment_role = 'follower' THEN ca.follower_rate_adjustment / 100 ELSE 1 END) / 100
      ELSE 0
    END
  ) as total_commission
FROM commission_assignments ca
JOIN opportunity_cache oc ON oc.opportunity_id = ca.opportunity_id 
  AND oc.organization_id = ca.organization_id
WHERE ca.is_active = true 
  AND ca.is_disabled = false
GROUP BY ca.opportunity_id, ca.organization_id;

-- 7. Add organization settings for follower commissions
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS follower_commission_settings JSONB DEFAULT '{
  "enabled": true,
  "default_follower_rate": 50,
  "max_commissioned_followers": 5,
  "require_approval_above": 10000
}'::jsonb;

COMMENT ON COLUMN opportunity_cache.followers IS 'Array of GHL user IDs who are following this opportunity';
COMMENT ON COLUMN commission_assignments.assignment_role IS 'Role of the assignee: primary (main assignee), follower (opportunity follower), split (equal split), override (manual override)';
COMMENT ON COLUMN commission_assignments.follower_rate_adjustment IS 'Percentage of base rate for followers (e.g., 50 = follower gets 50% of their normal rate)';
COMMENT ON COLUMN commission_assignments.parent_assignment_id IS 'Reference to primary assignment for follower assignments';