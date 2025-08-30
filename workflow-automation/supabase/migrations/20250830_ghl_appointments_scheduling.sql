-- Create tables for GHL appointment scheduling and management

-- 1. Table for synced appointments from GoHighLevel
CREATE TABLE IF NOT EXISTS ghl_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Link to existing tables
  calendar_id VARCHAR(255) NOT NULL, -- References ghl_calendars.calendar_id
  appointment_id VARCHAR(255) NOT NULL, -- GHL appointment ID
  opportunity_id VARCHAR(255), -- References opportunity_cache.opportunity_id
  contact_id VARCHAR(255), -- References contacts.ghl_contact_id
  
  -- Assignment (using existing team_members)
  assigned_to VARCHAR(255), -- GHL user ID (matches team_members.external_id)
  team_member_id UUID REFERENCES team_members(id),
  
  -- Appointment details
  title VARCHAR(255),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50),
  appointment_type VARCHAR(100),
  
  -- Instructions and notes
  description TEXT, -- Customer-visible instructions
  internal_notes TEXT, -- Team-only notes
  
  -- Sync metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  ghl_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, appointment_id)
);

-- 2. Table for bulk scheduling configurations
CREATE TABLE IF NOT EXISTS appointment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Link to existing data
  calendar_id VARCHAR(255) NOT NULL, -- References ghl_calendars.calendar_id
  opportunity_id VARCHAR(255) NOT NULL, -- References opportunity_cache.opportunity_id
  team_member_id UUID REFERENCES team_members(id), -- Who to assign appointments to
  
  -- Schedule configuration
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  include_weekends BOOLEAN DEFAULT false,
  
  -- Details
  appointment_title_template VARCHAR(255), -- e.g., "{{customer_name}} - Site Visit"
  instructions TEXT,
  internal_notes TEXT,
  
  -- Tracking
  appointments_created INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'creating', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Junction table to track which appointments were created from which schedule
CREATE TABLE IF NOT EXISTS schedule_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES appointment_schedules(id) ON DELETE CASCADE,
  appointment_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(schedule_id, appointment_id)
);

-- Create indexes for performance
CREATE INDEX idx_ghl_appointments_org_id ON ghl_appointments(organization_id);
CREATE INDEX idx_ghl_appointments_calendar_id ON ghl_appointments(calendar_id);
CREATE INDEX idx_ghl_appointments_opportunity_id ON ghl_appointments(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_ghl_appointments_contact_id ON ghl_appointments(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_ghl_appointments_team_member_id ON ghl_appointments(team_member_id) WHERE team_member_id IS NOT NULL;
CREATE INDEX idx_ghl_appointments_assigned_to ON ghl_appointments(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_ghl_appointments_start_time ON ghl_appointments(start_time);
CREATE INDEX idx_ghl_appointments_status ON ghl_appointments(status);

CREATE INDEX idx_appointment_schedules_org_id ON appointment_schedules(organization_id);
CREATE INDEX idx_appointment_schedules_calendar_id ON appointment_schedules(calendar_id);
CREATE INDEX idx_appointment_schedules_opportunity_id ON appointment_schedules(opportunity_id);
CREATE INDEX idx_appointment_schedules_team_member_id ON appointment_schedules(team_member_id) WHERE team_member_id IS NOT NULL;
CREATE INDEX idx_appointment_schedules_status ON appointment_schedules(status);
CREATE INDEX idx_appointment_schedules_created_by ON appointment_schedules(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX idx_schedule_appointments_schedule_id ON schedule_appointments(schedule_id);
CREATE INDEX idx_schedule_appointments_appointment_id ON schedule_appointments(appointment_id);

-- Create triggers for updated_at
CREATE TRIGGER update_ghl_appointments_updated_at 
  BEFORE UPDATE ON ghl_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_schedules_updated_at 
  BEFORE UPDATE ON appointment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ghl_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ghl_appointments
CREATE POLICY "Organization members can view appointments" ON ghl_appointments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage appointments" ON ghl_appointments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'administrator')
    )
  );

-- RLS Policies for appointment_schedules
CREATE POLICY "Organization members can view schedules" ON appointment_schedules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can manage schedules" ON appointment_schedules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'administrator', 'sales')
    )
  );

-- RLS Policies for schedule_appointments
CREATE POLICY "Organization members can view schedule appointments" ON schedule_appointments
  FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM appointment_schedules
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Organization admins can manage schedule appointments" ON schedule_appointments
  FOR ALL USING (
    schedule_id IN (
      SELECT id FROM appointment_schedules
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'administrator')
      )
    )
  );