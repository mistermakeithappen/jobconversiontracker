-- Create time_entries table for tracking work hours per opportunity
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id VARCHAR NOT NULL,
  integration_id VARCHAR NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  user_email VARCHAR NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0),
  hourly_rate DECIMAL(8,2),
  description TEXT NOT NULL,
  work_date DATE NOT NULL,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_opportunity_id ON time_entries(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_ghl_user_id ON time_entries(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_time_entries_updated_at 
    BEFORE UPDATE ON time_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own time entries" ON time_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time entries" ON time_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries" ON time_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries" ON time_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE time_entries IS 'Tracks work hours and labor costs per opportunity/project';
COMMENT ON COLUMN time_entries.opportunity_id IS 'GoHighLevel opportunity ID this time entry is associated with';
COMMENT ON COLUMN time_entries.ghl_user_id IS 'GoHighLevel user ID of the person who performed the work';
COMMENT ON COLUMN time_entries.hours IS 'Number of hours worked (supports quarter-hour increments)';
COMMENT ON COLUMN time_entries.hourly_rate IS 'Rate per hour for this work (optional)';
COMMENT ON COLUMN time_entries.total_cost IS 'Calculated total cost (hours * hourly_rate)';
COMMENT ON COLUMN time_entries.work_date IS 'Date when the work was performed';