-- Create opportunity_commissions table
CREATE TABLE IF NOT EXISTS opportunity_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  commission_type VARCHAR(50) NOT NULL, -- 'gross', 'profit', 'custom'
  commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  commission_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique assignment per user per opportunity
  UNIQUE(organization_id, opportunity_id, ghl_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_org ON opportunity_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_opportunity_id ON opportunity_commissions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_ghl_user_id ON opportunity_commissions(ghl_user_id);

-- Create updated_at trigger
CREATE TRIGGER update_opportunity_commissions_updated_at 
    BEFORE UPDATE ON opportunity_commissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE opportunity_commissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization members can view opportunity commissions" ON opportunity_commissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = opportunity_commissions.organization_id
              AND om.user_id = auth.uid()
              AND om.status = 'active'
        )
    );