-- Create table for storing GoHighLevel calendars
CREATE TABLE IF NOT EXISTS ghl_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  calendar_id VARCHAR(255) NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calendar_type VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, calendar_id)
);

-- Create index for faster lookups
CREATE INDEX idx_ghl_calendars_org_id ON ghl_calendars(organization_id);
CREATE INDEX idx_ghl_calendars_integration_id ON ghl_calendars(integration_id);
CREATE INDEX idx_ghl_calendars_location_id ON ghl_calendars(location_id);
CREATE INDEX idx_ghl_calendars_calendar_id ON ghl_calendars(calendar_id);

-- Add RLS policies
ALTER TABLE ghl_calendars ENABLE ROW LEVEL SECURITY;

-- Policy for organization members to view calendars
CREATE POLICY "Organization members can view calendars" ON ghl_calendars
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for organization admins to manage calendars
CREATE POLICY "Organization admins can manage calendars" ON ghl_calendars
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ghl_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_ghl_calendars_updated_at
  BEFORE UPDATE ON ghl_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_calendars_updated_at();