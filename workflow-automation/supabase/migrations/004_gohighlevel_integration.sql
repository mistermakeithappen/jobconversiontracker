-- 004_gohighlevel_integration.sql
-- GoHighLevel integration tables for contacts, opportunities, and receipts

-- 1. Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_contact_id VARCHAR(255) NOT NULL,
  ghl_location_id VARCHAR(255) NOT NULL,
  
  -- Contact information
  email VARCHAR(255),
  phone VARCHAR(50),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(255),
  company_name VARCHAR(255),
  
  -- Address
  address1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  
  -- Additional fields
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  source VARCHAR(255),
  
  -- Sync metadata
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'synced',
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ghl_created_at TIMESTAMP WITH TIME ZONE,
  ghl_updated_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(integration_id, ghl_contact_id)
);

-- 2. Contact sync logs
CREATE TABLE contact_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook', 'manual')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  total_contacts INTEGER DEFAULT 0,
  synced_contacts INTEGER DEFAULT 0,
  failed_contacts INTEGER DEFAULT 0,
  
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Pipeline stages
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_pipeline_id VARCHAR(255) NOT NULL,
  ghl_stage_id VARCHAR(255) NOT NULL,
  
  -- Stage information
  pipeline_name VARCHAR(255) NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  stage_position INTEGER,
  
  -- Analysis fields
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_status VARCHAR(50) CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'error')),
  completion_percentage DECIMAL(5,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(integration_id, ghl_pipeline_id, ghl_stage_id)
);

-- 4. Opportunity receipts
CREATE TABLE opportunity_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identifiers
  opportunity_id VARCHAR(255) NOT NULL,
  contact_id VARCHAR(255),
  
  -- Receipt details
  amount DECIMAL(10,2) NOT NULL,
  receipt_date DATE NOT NULL,
  receipt_type VARCHAR(50) CHECK (receipt_type IN ('expense', 'mileage', 'other')),
  category VARCHAR(100),
  description TEXT,
  
  -- Image storage
  image_url TEXT,
  thumbnail_url TEXT,
  
  -- Reimbursable flag and processing
  is_reimbursable BOOLEAN DEFAULT false,
  reimbursement_status VARCHAR(50) DEFAULT 'pending' CHECK (
    reimbursement_status IN ('pending', 'approved', 'paid', 'rejected')
  ),
  
  -- Team member assignment
  team_member_id UUID REFERENCES team_members(id),
  submitted_by_name VARCHAR(255),
  submitted_by_phone VARCHAR(50),
  
  -- AI processing
  ai_extracted_data JSONB,
  ai_confidence_score DECIMAL(3,2),
  manual_review_required BOOLEAN DEFAULT false,
  
  -- Company credit card tracking
  company_card_id UUID,
  is_company_card_expense BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 5. Receipt processing log
CREATE TABLE receipt_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Source information
  source VARCHAR(50) NOT NULL CHECK (source IN ('web_upload', 'sms', 'email', 'api')),
  phone_number VARCHAR(50),
  email VARCHAR(255),
  
  -- Message details (for SMS/email)
  message_id VARCHAR(255),
  message_text TEXT,
  attachment_id VARCHAR(255),
  attachment_url TEXT,
  
  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')
  ),
  
  -- AI processing results
  ai_response TEXT,
  extracted_data JSONB,
  potential_matches JSONB DEFAULT '[]',
  
  -- Response handling
  response_message TEXT,
  response_sent BOOLEAN DEFAULT false,
  response_sent_at TIMESTAMP WITH TIME ZONE,
  response_error TEXT,
  ghl_message_response JSONB,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Receipt reference
  receipt_id UUID REFERENCES opportunity_receipts(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Time entries
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id VARCHAR(255) NOT NULL,
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  
  -- Time tracking
  date DATE NOT NULL,
  hours_worked DECIMAL(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  
  -- Work details
  work_type VARCHAR(100),
  description TEXT,
  
  -- Billing
  hourly_rate DECIMAL(10,2),
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  is_billable BOOLEAN DEFAULT true,
  
  -- Status
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected')
  ),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 7. Company credit cards
CREATE TABLE company_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Card details
  card_name VARCHAR(255) NOT NULL,
  last_four VARCHAR(4) NOT NULL,
  card_type VARCHAR(50), -- visa, mastercard, amex, etc
  
  -- Assignment
  assigned_to UUID REFERENCES team_members(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, last_four)
);

-- Create indexes
CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_integration ON contacts(integration_id);
CREATE INDEX idx_contacts_ghl_id ON contacts(ghl_contact_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);

CREATE INDEX idx_contact_sync_logs_org ON contact_sync_logs(organization_id);
CREATE INDEX idx_contact_sync_logs_integration ON contact_sync_logs(integration_id);

CREATE INDEX idx_pipeline_stages_org ON pipeline_stages(organization_id);
CREATE INDEX idx_pipeline_stages_integration ON pipeline_stages(integration_id);

CREATE INDEX idx_opportunity_receipts_org ON opportunity_receipts(organization_id);
CREATE INDEX idx_opportunity_receipts_opportunity ON opportunity_receipts(opportunity_id);
CREATE INDEX idx_opportunity_receipts_team_member ON opportunity_receipts(team_member_id);
CREATE INDEX idx_opportunity_receipts_reimbursable ON opportunity_receipts(is_reimbursable) WHERE is_reimbursable = true;

CREATE INDEX idx_receipt_processing_log_org ON receipt_processing_log(organization_id);
CREATE INDEX idx_receipt_processing_log_status ON receipt_processing_log(processing_status);
CREATE INDEX idx_receipt_processing_log_phone ON receipt_processing_log(phone_number) WHERE phone_number IS NOT NULL;

CREATE INDEX idx_time_entries_org ON time_entries(organization_id);
CREATE INDEX idx_time_entries_opportunity ON time_entries(opportunity_id);
CREATE INDEX idx_time_entries_team_member ON time_entries(team_member_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);

CREATE INDEX idx_company_credit_cards_org ON company_credit_cards(organization_id);
CREATE INDEX idx_company_credit_cards_assigned ON company_credit_cards(assigned_to) WHERE assigned_to IS NOT NULL;

-- Create triggers
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunity_receipts_updated_at BEFORE UPDATE ON opportunity_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_credit_cards_updated_at BEFORE UPDATE ON company_credit_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages DISABLE ROW LEVEL SECURITY; -- Disabled as per original migration
ALTER TABLE opportunity_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_credit_cards ENABLE ROW LEVEL SECURITY;