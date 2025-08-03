-- Simplified migration to create GHL contacts tables
-- Run this in Supabase SQL Editor

-- Create the main contacts table
CREATE TABLE IF NOT EXISTS ghl_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  company_name VARCHAR(255),
  address1 TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(50),
  timezone VARCHAR(50),
  website TEXT,
  type VARCHAR(50),
  source VARCHAR(255),
  assigned_to VARCHAR(255),
  dnd BOOLEAN DEFAULT false,
  business_id VARCHAR(255),
  date_of_birth DATE,
  date_added TIMESTAMPTZ,
  date_updated TIMESTAMPTZ,
  tags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  additional_emails JSONB DEFAULT '[]'::jsonb,
  attributions JSONB DEFAULT '[]'::jsonb,
  dnd_settings JSONB DEFAULT '{}'::jsonb,
  followers JSONB DEFAULT '[]'::jsonb,
  social_profiles JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'active',
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, contact_id)
);

-- Create sync logs table
CREATE TABLE IF NOT EXISTS ghl_contact_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  contacts_processed INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  contacts_updated INTEGER DEFAULT 0,
  contacts_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_user_id ON ghl_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_location_id ON ghl_contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_email ON ghl_contacts(email);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_phone ON ghl_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_search ON ghl_contacts(first_name, last_name, contact_name);

-- Enable RLS
ALTER TABLE ghl_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_contact_sync_logs ENABLE ROW LEVEL SECURITY;