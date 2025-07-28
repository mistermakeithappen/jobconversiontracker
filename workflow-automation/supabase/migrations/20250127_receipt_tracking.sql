-- Create table for tracking receipts/expenses for opportunities
CREATE TABLE IF NOT EXISTS opportunity_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL, -- GHL opportunity ID
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Receipt details
  vendor_name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL, -- materials, labor, equipment, etc.
  receipt_date DATE NOT NULL,
  receipt_number TEXT,
  
  -- File storage
  receipt_url TEXT, -- URL to uploaded receipt image/pdf
  receipt_filename TEXT,
  
  -- Metadata
  notes TEXT,
  tags TEXT[], -- Array of tags for categorization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create table for caching opportunity data with profitability metrics
CREATE TABLE IF NOT EXISTS opportunity_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL UNIQUE, -- GHL opportunity ID
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL opportunity data
  name TEXT NOT NULL,
  contact_id TEXT,
  contact_name TEXT,
  pipeline_id TEXT NOT NULL,
  pipeline_name TEXT,
  pipeline_stage_id TEXT,
  pipeline_stage_name TEXT,
  status TEXT,
  monetary_value DECIMAL(10, 2),
  
  -- Profitability tracking
  total_expenses DECIMAL(10, 2) DEFAULT 0,
  net_profit DECIMAL(10, 2) GENERATED ALWAYS AS (COALESCE(monetary_value, 0) - COALESCE(total_expenses, 0)) STORED,
  profit_margin DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(monetary_value, 0) = 0 THEN 0
      ELSE ((COALESCE(monetary_value, 0) - COALESCE(total_expenses, 0)) / monetary_value * 100)
    END
  ) STORED,
  
  -- Metadata
  ghl_created_at TIMESTAMP WITH TIME ZONE,
  ghl_updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX idx_opportunity_receipts_user_id ON opportunity_receipts(user_id);
CREATE INDEX idx_opportunity_receipts_opportunity_id ON opportunity_receipts(opportunity_id);
CREATE INDEX idx_opportunity_receipts_integration_id ON opportunity_receipts(integration_id);
CREATE INDEX idx_opportunity_receipts_receipt_date ON opportunity_receipts(receipt_date);
CREATE INDEX idx_opportunity_receipts_category ON opportunity_receipts(category);

CREATE INDEX idx_opportunity_cache_user_id ON opportunity_cache(user_id);
CREATE INDEX idx_opportunity_cache_integration_id ON opportunity_cache(integration_id);
CREATE INDEX idx_opportunity_cache_pipeline_id ON opportunity_cache(pipeline_id);
CREATE INDEX idx_opportunity_cache_status ON opportunity_cache(status);

-- Create function to update total expenses when receipts change
CREATE OR REPLACE FUNCTION update_opportunity_expenses()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the total_expenses in opportunity_cache
  UPDATE opportunity_cache
  SET 
    total_expenses = (
      SELECT COALESCE(SUM(amount), 0)
      FROM opportunity_receipts
      WHERE opportunity_id = COALESCE(NEW.opportunity_id, OLD.opportunity_id)
    ),
    updated_at = TIMEZONE('utc', NOW())
  WHERE opportunity_id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update expenses
CREATE TRIGGER update_expenses_on_receipt_insert
  AFTER INSERT ON opportunity_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_expenses();

CREATE TRIGGER update_expenses_on_receipt_update
  AFTER UPDATE ON opportunity_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_expenses();

CREATE TRIGGER update_expenses_on_receipt_delete
  AFTER DELETE ON opportunity_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_expenses();

-- Add RLS policies
ALTER TABLE opportunity_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_cache ENABLE ROW LEVEL SECURITY;

-- Users can only access their own receipts
CREATE POLICY "Users can view their own receipts"
  ON opportunity_receipts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own receipts"
  ON opportunity_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own receipts"
  ON opportunity_receipts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own receipts"
  ON opportunity_receipts FOR DELETE
  USING (user_id = auth.uid());

-- Users can only access their own opportunity cache
CREATE POLICY "Users can view their own opportunities"
  ON opportunity_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own opportunities"
  ON opportunity_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own opportunities"
  ON opportunity_cache FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own opportunities"
  ON opportunity_cache FOR DELETE
  USING (user_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_opportunity_receipts
  BEFORE UPDATE ON opportunity_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_opportunity_cache
  BEFORE UPDATE ON opportunity_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();