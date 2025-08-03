-- 017_estimates_invoices_integration.sql
-- Creates dedicated estimates and invoices tables with proper relationships to opportunities and commission tracking

-- 1. Estimates Table - Store estimate data with opportunity linkage
CREATE TABLE ghl_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_estimate_id VARCHAR(255) NOT NULL,
  estimate_number VARCHAR(255),
  
  -- Opportunity relationship (can be created from opportunity or standalone)
  opportunity_id VARCHAR(255), -- GHL opportunity ID
  contact_id VARCHAR(255) NOT NULL, -- GHL contact ID
  
  -- Estimate details
  name VARCHAR(500) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'cancelled'
  )),
  
  -- Dates
  created_date TIMESTAMP WITH TIME ZONE,
  sent_date TIMESTAMP WITH TIME ZONE,
  viewed_date TIMESTAMP WITH TIME ZONE,
  response_date TIMESTAMP WITH TIME ZONE, -- When accepted/declined
  expiry_date TIMESTAMP WITH TIME ZONE,
  
  -- Conversion tracking
  converted_to_invoice BOOLEAN DEFAULT FALSE,
  converted_invoice_id UUID, -- References ghl_invoices.id when converted
  
  -- Line items and metadata
  line_items JSONB DEFAULT '[]',
  terms TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Sync tracking
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, ghl_estimate_id)
);

-- 2. Invoices Table - Store invoice data with estimate and opportunity linkage
CREATE TABLE ghl_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- GHL identifiers
  ghl_invoice_id VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(255),
  
  -- Source relationships
  opportunity_id VARCHAR(255), -- GHL opportunity ID (can be created from opportunity)
  estimate_id UUID REFERENCES ghl_estimates(id), -- Internal estimate ID if converted from estimate
  contact_id VARCHAR(255) NOT NULL, -- GHL contact ID
  
  -- Invoice details
  name VARCHAR(500) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled'
  )),
  
  -- Payment tracking
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_due DECIMAL(12,2) GENERATED ALWAYS AS (amount - amount_paid) STORED,
  
  -- Dates
  created_date TIMESTAMP WITH TIME ZONE,
  sent_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_date TIMESTAMP WITH TIME ZONE,
  
  -- Line items and metadata
  line_items JSONB DEFAULT '[]',
  payment_terms VARCHAR(255),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Sync tracking
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, ghl_invoice_id)
);

-- 3. Add foreign key constraint for estimate-to-invoice conversion
ALTER TABLE ghl_estimates 
ADD CONSTRAINT fk_estimates_converted_invoice 
FOREIGN KEY (converted_invoice_id) REFERENCES ghl_invoices(id) ON DELETE SET NULL;

-- 4. Estimate Status History - Track status changes for estimates
CREATE TABLE ghl_estimate_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES ghl_estimates(id) ON DELETE CASCADE,
  
  -- Status change details
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by VARCHAR(255), -- GHL user who made the change
  
  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 5. Invoice Status History - Track status changes for invoices
CREATE TABLE ghl_invoice_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES ghl_invoices(id) ON DELETE CASCADE,
  
  -- Status change details
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by VARCHAR(255), -- GHL user who made the change
  
  -- Payment details (for payment-related status changes)
  payment_amount DECIMAL(12,2),
  payment_method VARCHAR(255),
  transaction_id VARCHAR(255),
  
  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 6. Create indexes for performance
CREATE INDEX idx_ghl_estimates_organization ON ghl_estimates(organization_id);
CREATE INDEX idx_ghl_estimates_ghl_id ON ghl_estimates(ghl_estimate_id);
CREATE INDEX idx_ghl_estimates_opportunity ON ghl_estimates(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_ghl_estimates_contact ON ghl_estimates(contact_id);
CREATE INDEX idx_ghl_estimates_status ON ghl_estimates(status);
CREATE INDEX idx_ghl_estimates_converted ON ghl_estimates(converted_to_invoice) WHERE converted_to_invoice = TRUE;

CREATE INDEX idx_ghl_invoices_organization ON ghl_invoices(organization_id);
CREATE INDEX idx_ghl_invoices_ghl_id ON ghl_invoices(ghl_invoice_id);
CREATE INDEX idx_ghl_invoices_opportunity ON ghl_invoices(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_ghl_invoices_estimate ON ghl_invoices(estimate_id) WHERE estimate_id IS NOT NULL;
CREATE INDEX idx_ghl_invoices_contact ON ghl_invoices(contact_id);
CREATE INDEX idx_ghl_invoices_status ON ghl_invoices(status);
CREATE INDEX idx_ghl_invoices_due_date ON ghl_invoices(due_date) WHERE status IN ('sent', 'viewed', 'partially_paid');

CREATE INDEX idx_estimate_status_history_estimate ON ghl_estimate_status_history(estimate_id, changed_at);
CREATE INDEX idx_invoice_status_history_invoice ON ghl_invoice_status_history(invoice_id, changed_at);

-- 7. Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_ghl_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ghl_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers for updated_at
CREATE TRIGGER trigger_ghl_estimates_updated_at
  BEFORE UPDATE ON ghl_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_estimates_updated_at();

CREATE TRIGGER trigger_ghl_invoices_updated_at
  BEFORE UPDATE ON ghl_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_invoices_updated_at();

-- 9. Create trigger functions for status history tracking
CREATE OR REPLACE FUNCTION track_estimate_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ghl_estimate_status_history (
      estimate_id,
      from_status,
      to_status,
      changed_at,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NOW(),
      jsonb_build_object('trigger', 'automatic')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION track_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ghl_invoice_status_history (
      invoice_id,
      from_status,
      to_status,
      changed_at,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NOW(),
      jsonb_build_object('trigger', 'automatic')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create triggers for status history
CREATE TRIGGER trigger_estimate_status_history
  AFTER UPDATE ON ghl_estimates
  FOR EACH ROW
  EXECUTE FUNCTION track_estimate_status_change();

CREATE TRIGGER trigger_invoice_status_history
  AFTER UPDATE ON ghl_invoices
  FOR EACH ROW
  EXECUTE FUNCTION track_invoice_status_change();

-- 11. Create a function to convert estimate to invoice
CREATE OR REPLACE FUNCTION convert_estimate_to_invoice(
  p_estimate_id UUID,
  p_ghl_invoice_id VARCHAR(255),
  p_invoice_number VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_estimate ghl_estimates%ROWTYPE;
  v_invoice_id UUID;
BEGIN
  -- Get the estimate
  SELECT * INTO v_estimate FROM ghl_estimates WHERE id = p_estimate_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found: %', p_estimate_id;
  END IF;
  
  -- Create the invoice
  INSERT INTO ghl_invoices (
    organization_id,
    integration_id,
    ghl_invoice_id,
    invoice_number,
    opportunity_id,
    estimate_id,
    contact_id,
    name,
    description,
    amount,
    currency,
    line_items,
    notes,
    metadata,
    created_date
  ) VALUES (
    v_estimate.organization_id,
    v_estimate.integration_id,
    p_ghl_invoice_id,
    p_invoice_number,
    v_estimate.opportunity_id,
    p_estimate_id,
    v_estimate.contact_id,
    v_estimate.name,
    v_estimate.description,
    v_estimate.amount,
    v_estimate.currency,
    v_estimate.line_items,
    v_estimate.notes,
    v_estimate.metadata,
    NOW()
  ) RETURNING id INTO v_invoice_id;
  
  -- Update the estimate to mark it as converted
  UPDATE ghl_estimates 
  SET 
    converted_to_invoice = TRUE,
    converted_invoice_id = v_invoice_id,
    status = CASE WHEN status = 'accepted' THEN 'accepted' ELSE 'converted' END,
    updated_at = NOW()
  WHERE id = p_estimate_id;
  
  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- 12. Create views for easier querying
CREATE VIEW estimates_with_conversions AS
SELECT 
  e.*,
  i.ghl_invoice_id as converted_invoice_ghl_id,
  i.invoice_number as converted_invoice_number,
  i.status as converted_invoice_status,
  i.amount_paid as converted_invoice_amount_paid
FROM ghl_estimates e
LEFT JOIN ghl_invoices i ON e.converted_invoice_id = i.id;

CREATE VIEW invoices_with_sources AS
SELECT 
  i.*,
  e.ghl_estimate_id as source_estimate_ghl_id,
  e.estimate_number as source_estimate_number,
  e.status as source_estimate_status,
  CASE 
    WHEN e.id IS NOT NULL THEN 'estimate'
    WHEN i.opportunity_id IS NOT NULL THEN 'opportunity'
    ELSE 'direct'
  END as source_type
FROM ghl_invoices i
LEFT JOIN ghl_estimates e ON i.estimate_id = e.id;

-- 13. Update RLS policies
ALTER TABLE ghl_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_estimate_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_invoice_status_history ENABLE ROW LEVEL SECURITY;

-- Estimates policies
CREATE POLICY "Users can view estimates in their organization" ON ghl_estimates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert estimates in their organization" ON ghl_estimates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update estimates in their organization" ON ghl_estimates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Invoices policies
CREATE POLICY "Users can view invoices in their organization" ON ghl_invoices
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices in their organization" ON ghl_invoices
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices in their organization" ON ghl_invoices
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Status history policies (read-only for users)
CREATE POLICY "Users can view estimate status history in their organization" ON ghl_estimate_status_history
  FOR SELECT USING (
    estimate_id IN (
      SELECT id FROM ghl_estimates 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view invoice status history in their organization" ON ghl_invoice_status_history
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM ghl_invoices 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service role policies (for API access)
CREATE POLICY "Service role can manage all estimates" ON ghl_estimates
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all invoices" ON ghl_invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all estimate status history" ON ghl_estimate_status_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all invoice status history" ON ghl_invoice_status_history
  FOR ALL USING (auth.role() = 'service_role');