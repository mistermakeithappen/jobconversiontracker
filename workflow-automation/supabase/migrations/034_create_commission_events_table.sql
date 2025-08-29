-- 034_create_commission_events_table.sql
-- Create commission_events table for tracking payment events and commission triggers

-- Create commission_events table
CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event details
  event_source VARCHAR(50) NOT NULL CHECK (event_source IN ('invoice', 'payment', 'subscription', 'opportunity', 'manual')),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('payment_collected', 'invoice_paid', 'invoice_sent', 'opportunity_won', 'commission_override')),
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Related entities
  opportunity_id VARCHAR(255), -- GHL opportunity ID
  invoice_id VARCHAR(255), -- GHL invoice ID or internal UUID
  payment_id VARCHAR(255), -- GHL payment ID
  subscription_id VARCHAR(255), -- GHL subscription ID
  contact_id VARCHAR(255), -- GHL contact ID
  
  -- Financial details
  event_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Additional event data (flexible JSON field)
  event_data JSONB DEFAULT '{}',
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_events_organization ON commission_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_opportunity ON commission_events(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_events_invoice ON commission_events(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_events_contact ON commission_events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_events_type ON commission_events(event_type);
CREATE INDEX IF NOT EXISTS idx_commission_events_source ON commission_events(event_source);
CREATE INDEX IF NOT EXISTS idx_commission_events_date ON commission_events(event_date);
CREATE INDEX IF NOT EXISTS idx_commission_events_processed ON commission_events(processed) WHERE processed = FALSE;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_commission_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_commission_events_updated_at
  BEFORE UPDATE ON commission_events
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_events_updated_at();

-- Enable RLS
ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view commission events in their organization" ON commission_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert commission events in their organization" ON commission_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update commission events in their organization" ON commission_events
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Service role policies (for webhook and API access)
CREATE POLICY "Service role can manage all commission events" ON commission_events
  FOR ALL USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE commission_events IS 'Track payment events and triggers for commission calculations';
COMMENT ON COLUMN commission_events.event_source IS 'Source system that generated this event (invoice, payment, etc.)';
COMMENT ON COLUMN commission_events.event_type IS 'Type of event that occurred (payment_collected, invoice_paid, etc.)';
COMMENT ON COLUMN commission_events.event_data IS 'Additional flexible data about the event (payment method, transaction details, etc.)';
COMMENT ON COLUMN commission_events.processed IS 'Whether this event has been processed for commission calculations';

-- Create a view for easier querying of payment events
CREATE OR REPLACE VIEW payment_events_summary AS
SELECT 
  ce.*,
  -- Extract commonly used event_data fields
  (ce.event_data->>'payment_method') as payment_method,
  (ce.event_data->>'transaction_id') as transaction_id,
  (ce.event_data->>'invoice_number') as invoice_number,
  (ce.event_data->>'full_amount_paid')::boolean as full_amount_paid,
  
  -- Add organization context
  o.name as organization_name
FROM commission_events ce
LEFT JOIN organizations o ON ce.organization_id = o.id
WHERE ce.event_type IN ('payment_collected', 'invoice_paid')
ORDER BY ce.event_date DESC;
