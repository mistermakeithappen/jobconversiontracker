-- 027_properties_system.sql
-- Creates properties database with contact associations, tax rates, and estimate/invoice relationships

-- 1. Tax rates table - stores tax rates by postal code
CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_code VARCHAR(20) NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL, -- e.g., 0.0825 for 8.25%
  tax_description VARCHAR(255),
  state VARCHAR(2),
  county VARCHAR(100),
  city VARCHAR(100),
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(postal_code, effective_date)
);

-- 2. Properties table - main property information
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Property identification
  nickname VARCHAR(255), -- Optional friendly name
  property_type VARCHAR(50) CHECK (property_type IN (
    'residential', 'commercial', 'industrial', 'land', 'mixed_use', 'other'
  )),
  
  -- Address information (separate from contact address)
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'USA',
  
  -- Full address for search and display
  full_address TEXT GENERATED ALWAYS AS (
    TRIM(BOTH FROM 
      COALESCE(address1, '') || 
      CASE WHEN address2 IS NOT NULL AND address2 != '' 
        THEN ', ' || address2 
        ELSE '' 
      END || 
      ', ' || COALESCE(city, '') || 
      ', ' || COALESCE(state, '') || 
      ' ' || COALESCE(postal_code, '')
    )
  ) STORED,
  
  -- Tax information
  tax_rate_id UUID REFERENCES tax_rates(id),
  custom_tax_rate DECIMAL(5,4), -- Override if different from zipcode default
  tax_exempt BOOLEAN DEFAULT FALSE,
  tax_exempt_reason TEXT,
  
  -- Property details
  square_footage INTEGER,
  lot_size DECIMAL(10,2), -- in acres
  year_built INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  
  -- Additional information
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 3. Property contacts junction table - many-to-many relationship
CREATE TABLE property_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- Relationship details
  relationship_type VARCHAR(50) DEFAULT 'owner' CHECK (relationship_type IN (
    'owner', 'tenant', 'property_manager', 'agent', 'contractor', 'other'
  )),
  is_primary BOOLEAN DEFAULT FALSE,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Additional information
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(property_id, contact_id, relationship_type)
);

-- 4. Update estimates table to include property reference (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ghl_estimates') THEN
    ALTER TABLE ghl_estimates 
    ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id),
    ADD COLUMN IF NOT EXISTS property_address TEXT, -- Store denormalized for historical accuracy
    ADD COLUMN IF NOT EXISTS applied_tax_rate DECIMAL(5,4); -- Tax rate used at time of estimate
  END IF;
END $$;

-- 5. Update invoices table to include property reference (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ghl_invoices') THEN
    ALTER TABLE ghl_invoices 
    ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id),
    ADD COLUMN IF NOT EXISTS property_address TEXT, -- Store denormalized for historical accuracy
    ADD COLUMN IF NOT EXISTS applied_tax_rate DECIMAL(5,4); -- Tax rate used at time of invoice
  END IF;
END $$;

-- 6. Create property history table for tracking changes
CREATE TABLE property_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- What changed
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  
  -- Who and when
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_reason TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- 7. Create indexes for performance
CREATE INDEX idx_properties_organization ON properties(organization_id);
CREATE INDEX idx_properties_postal_code ON properties(postal_code);
CREATE INDEX idx_properties_full_address ON properties(full_address);
CREATE INDEX idx_properties_active ON properties(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_property_contacts_property ON property_contacts(property_id);
CREATE INDEX idx_property_contacts_contact ON property_contacts(contact_id);
CREATE INDEX idx_property_contacts_primary ON property_contacts(property_id) WHERE is_primary = TRUE;

CREATE INDEX idx_tax_rates_postal_code ON tax_rates(postal_code);
CREATE INDEX idx_tax_rates_effective ON tax_rates(postal_code, effective_date);

-- Create indexes for estimates and invoices (only if tables exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ghl_estimates') THEN
    CREATE INDEX IF NOT EXISTS idx_estimates_property ON ghl_estimates(property_id) WHERE property_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ghl_invoices') THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_property ON ghl_invoices(property_id) WHERE property_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX idx_property_history_property ON property_history(property_id, changed_at);

-- 8. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_properties_updated_at();

-- 9. Create trigger for property history tracking
CREATE OR REPLACE FUNCTION track_property_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB := '{}';
BEGIN
  -- Track specific field changes
  IF OLD.nickname IS DISTINCT FROM NEW.nickname THEN
    INSERT INTO property_history (property_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'nickname', OLD.nickname, NEW.nickname);
  END IF;
  
  IF OLD.address1 IS DISTINCT FROM NEW.address1 THEN
    INSERT INTO property_history (property_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'address1', OLD.address1, NEW.address1);
  END IF;
  
  IF OLD.tax_exempt IS DISTINCT FROM NEW.tax_exempt THEN
    INSERT INTO property_history (property_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'tax_exempt', OLD.tax_exempt::TEXT, NEW.tax_exempt::TEXT);
  END IF;
  
  IF OLD.custom_tax_rate IS DISTINCT FROM NEW.custom_tax_rate THEN
    INSERT INTO property_history (property_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'custom_tax_rate', OLD.custom_tax_rate::TEXT, NEW.custom_tax_rate::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_property_changes
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION track_property_changes();

-- 10. Create views for easier querying
CREATE VIEW properties_with_contacts AS
SELECT 
  p.*,
  pc.contact_id,
  c.full_name as contact_name,
  c.email as contact_email,
  c.phone as contact_phone,
  pc.relationship_type,
  pc.is_primary
FROM properties p
LEFT JOIN property_contacts pc ON p.id = pc.property_id
LEFT JOIN contacts c ON pc.contact_id = c.id;

CREATE VIEW properties_with_tax_info AS
SELECT 
  p.*,
  COALESCE(p.custom_tax_rate, tr.tax_rate) as effective_tax_rate,
  tr.tax_description,
  tr.state as tax_state,
  tr.county as tax_county,
  tr.city as tax_city
FROM properties p
LEFT JOIN tax_rates tr ON p.tax_rate_id = tr.id;

-- 11. Helper function to get property tax rate
CREATE OR REPLACE FUNCTION get_property_tax_rate(p_property_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_tax_rate DECIMAL(5,4);
  v_property properties%ROWTYPE;
  v_zipcode_rate DECIMAL(5,4);
BEGIN
  -- Get the property
  SELECT * INTO v_property FROM properties WHERE id = p_property_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Check if tax exempt
  IF v_property.tax_exempt THEN
    RETURN 0;
  END IF;
  
  -- Check for custom tax rate
  IF v_property.custom_tax_rate IS NOT NULL THEN
    RETURN v_property.custom_tax_rate;
  END IF;
  
  -- Check for linked tax rate
  IF v_property.tax_rate_id IS NOT NULL THEN
    SELECT tax_rate INTO v_tax_rate FROM tax_rates WHERE id = v_property.tax_rate_id;
    IF FOUND THEN
      RETURN v_tax_rate;
    END IF;
  END IF;
  
  -- Try to find rate by postal code
  SELECT tax_rate INTO v_zipcode_rate 
  FROM tax_rates 
  WHERE postal_code = v_property.postal_code
    AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN v_zipcode_rate;
  END IF;
  
  -- Default to no tax if no rate found
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 12. Helper function to get properties for a contact
CREATE OR REPLACE FUNCTION get_contact_properties(p_contact_id UUID)
RETURNS TABLE(
  property_id UUID,
  nickname VARCHAR(255),
  full_address TEXT,
  relationship_type VARCHAR(50),
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as property_id,
    p.nickname,
    p.full_address,
    pc.relationship_type,
    pc.is_primary
  FROM properties p
  JOIN property_contacts pc ON p.id = pc.property_id
  WHERE pc.contact_id = p_contact_id
    AND p.is_active = TRUE
    AND (pc.end_date IS NULL OR pc.end_date > CURRENT_DATE)
  ORDER BY pc.is_primary DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 13. RLS policies for properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

-- Properties policies
CREATE POLICY "Users can view properties in their organization" ON properties
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert properties in their organization" ON properties
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update properties in their organization" ON properties
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete properties in their organization" ON properties
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Property contacts policies
CREATE POLICY "Users can view property contacts in their organization" ON property_contacts
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage property contacts in their organization" ON property_contacts
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Property history policies (read-only for users)
CREATE POLICY "Users can view property history in their organization" ON property_history
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Tax rates policies (everyone can read, only service role can write)
CREATE POLICY "Everyone can view tax rates" ON tax_rates
  FOR SELECT USING (true);

-- Service role policies
CREATE POLICY "Service role can manage all properties" ON properties
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all property contacts" ON property_contacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all property history" ON property_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all tax rates" ON tax_rates
  FOR ALL USING (auth.role() = 'service_role');

-- 14. Insert some sample tax rates for common zipcodes
INSERT INTO tax_rates (postal_code, tax_rate, tax_description, state, county, city) VALUES
  ('10001', 0.08875, 'NY State and NYC Tax', 'NY', 'New York', 'New York'),
  ('90210', 0.0925, 'CA State and LA County Tax', 'CA', 'Los Angeles', 'Beverly Hills'),
  ('33139', 0.07, 'FL State and Miami-Dade Tax', 'FL', 'Miami-Dade', 'Miami Beach'),
  ('60601', 0.1025, 'IL State and Chicago Tax', 'IL', 'Cook', 'Chicago'),
  ('77001', 0.0825, 'TX State and Houston Tax', 'TX', 'Harris', 'Houston')
ON CONFLICT (postal_code, effective_date) DO NOTHING;