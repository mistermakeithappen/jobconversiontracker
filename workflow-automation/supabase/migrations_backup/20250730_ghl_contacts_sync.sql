-- Create table for syncing GoHighLevel contacts
CREATE TABLE IF NOT EXISTS ghl_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255) NOT NULL, -- GHL contact ID
  
  -- Basic info
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  contact_name VARCHAR(255), -- Full display name from GHL
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Additional contact info
  company_name VARCHAR(255),
  address1 TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(50),
  timezone VARCHAR(50),
  website TEXT,
  
  -- GHL specific fields
  type VARCHAR(50), -- lead, customer, etc.
  source VARCHAR(255),
  assigned_to VARCHAR(255),
  dnd BOOLEAN DEFAULT false,
  
  -- Business info
  business_id VARCHAR(255),
  
  -- Dates
  date_of_birth DATE,
  date_added TIMESTAMPTZ,
  date_updated TIMESTAMPTZ,
  
  -- JSON fields for complex data
  tags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  additional_emails JSONB DEFAULT '[]'::jsonb,
  attributions JSONB DEFAULT '[]'::jsonb,
  dnd_settings JSONB DEFAULT '{}'::jsonb,
  followers JSONB DEFAULT '[]'::jsonb,
  social_profiles JSONB DEFAULT '{}'::jsonb,
  
  -- Sync metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'active', -- active, deleted, error
  sync_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(location_id, contact_id)
);

-- Create indexes for efficient searching
CREATE INDEX idx_ghl_contacts_user_id ON ghl_contacts(user_id);
CREATE INDEX idx_ghl_contacts_location_id ON ghl_contacts(location_id);
CREATE INDEX idx_ghl_contacts_contact_id ON ghl_contacts(contact_id);
CREATE INDEX idx_ghl_contacts_email ON ghl_contacts(email);
CREATE INDEX idx_ghl_contacts_phone ON ghl_contacts(phone);
CREATE INDEX idx_ghl_contacts_name ON ghl_contacts(first_name, last_name);
CREATE INDEX idx_ghl_contacts_contact_name ON ghl_contacts(contact_name);
CREATE INDEX idx_ghl_contacts_sync_status ON ghl_contacts(sync_status);

-- Full text search index for name searching
CREATE INDEX idx_ghl_contacts_search ON ghl_contacts 
  USING gin(to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(contact_name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(phone, '')
  ));

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ghl_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_synced_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER update_ghl_contacts_updated_at
  BEFORE UPDATE ON ghl_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_contacts_updated_at();

-- Create table for tracking sync operations
CREATE TABLE IF NOT EXISTS ghl_contact_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id VARCHAR(255) NOT NULL,
  sync_type VARCHAR(50) NOT NULL, -- full, incremental, webhook
  status VARCHAR(50) NOT NULL, -- started, completed, failed
  contacts_processed INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  contacts_updated INTEGER DEFAULT 0,
  contacts_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for sync logs
CREATE INDEX idx_ghl_contact_sync_logs_user_id ON ghl_contact_sync_logs(user_id);
CREATE INDEX idx_ghl_contact_sync_logs_status ON ghl_contact_sync_logs(status);

-- Grant permissions (service role will handle this)
-- We'll use service role for all operations to bypass RLS

-- Add RLS policies
ALTER TABLE ghl_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_contact_sync_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own contacts
CREATE POLICY "Users can view own contacts" ON ghl_contacts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own sync logs" ON ghl_contact_sync_logs
  FOR SELECT USING (user_id = auth.uid());

-- Service role can do everything (API routes will use service role)
CREATE POLICY "Service role full access contacts" ON ghl_contacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sync logs" ON ghl_contact_sync_logs
  FOR ALL USING (auth.role() = 'service_role');