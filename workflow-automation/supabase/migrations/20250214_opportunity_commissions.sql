-- Create opportunity_commissions table for tracking commission assignments per opportunity
CREATE TABLE IF NOT EXISTS opportunity_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  integration_id VARCHAR NOT NULL,
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
  UNIQUE(opportunity_id, ghl_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_user_id ON opportunity_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_opportunity_id ON opportunity_commissions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_commissions_ghl_user_id ON opportunity_commissions(ghl_user_id);

-- Create updated_at trigger
CREATE TRIGGER update_opportunity_commissions_updated_at 
    BEFORE UPDATE ON opportunity_commissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE opportunity_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own opportunity commissions" ON opportunity_commissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own opportunity commissions" ON opportunity_commissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own opportunity commissions" ON opportunity_commissions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opportunity commissions" ON opportunity_commissions
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE opportunity_commissions IS 'Tracks commission assignments for specific opportunities';
COMMENT ON COLUMN opportunity_commissions.opportunity_id IS 'GoHighLevel opportunity ID this commission is associated with';
COMMENT ON COLUMN opportunity_commissions.ghl_user_id IS 'GoHighLevel user ID of the person receiving commission';
COMMENT ON COLUMN opportunity_commissions.commission_type IS 'Type of commission calculation: gross (% of revenue), profit (% of net profit), or custom (fixed amount)';
COMMENT ON COLUMN opportunity_commissions.commission_percentage IS 'Commission percentage (0-100)';
COMMENT ON COLUMN opportunity_commissions.commission_amount IS 'Calculated commission amount (auto-calculated or custom)';