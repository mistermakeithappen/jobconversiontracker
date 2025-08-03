import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function createGHLCalendarsTable() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Creating GHL calendars table...');

  try {
    // Check if table already exists
    const { data: existingTable } = await supabase
      .from('ghl_calendars')
      .select('*')
      .limit(1);
    
    if (existingTable) {
      console.log('Table ghl_calendars already exists');
      return;
    }
  } catch (error) {
    // Table doesn't exist, continue to create it
    console.log('Table does not exist yet, creating...');
  }

  // For now, let's just verify our connection works
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Database connection error:', error);
  } else {
    console.log('Database connection successful');
    console.log('Please run the migration SQL directly in Supabase dashboard:');
    console.log('\nSQL to run:');
    console.log(`
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

-- Create indexes
CREATE INDEX idx_ghl_calendars_org_id ON ghl_calendars(organization_id);
CREATE INDEX idx_ghl_calendars_integration_id ON ghl_calendars(integration_id);
CREATE INDEX idx_ghl_calendars_location_id ON ghl_calendars(location_id);
CREATE INDEX idx_ghl_calendars_calendar_id ON ghl_calendars(calendar_id);
    `);
  }
}

createGHLCalendarsTable().catch(console.error);