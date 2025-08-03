-- 014_business_context.sql
-- Business context system for AI bots

-- 1. Business contexts table
CREATE TABLE business_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Context',
  description TEXT,
  
  -- Core business information
  business_name TEXT NOT NULL,
  business_type TEXT, -- e.g., 'real_estate', 'dental', 'fitness', 'consulting'
  industry TEXT,
  
  -- Business details
  services_offered TEXT[], -- Array of services
  target_audience TEXT,
  unique_value_proposition TEXT,
  
  -- Communication preferences
  tone_of_voice TEXT, -- e.g., 'professional', 'friendly', 'casual', 'authoritative'
  language_style TEXT, -- e.g., 'formal', 'conversational', 'technical'
  
  -- Key information
  business_hours JSONB, -- Store hours by day
  contact_information JSONB, -- Phone, email, address, etc.
  key_policies TEXT[], -- Important policies to mention
  faqs JSONB[], -- Common Q&As
  
  -- AI behavior instructions
  response_guidelines TEXT[], -- How the bot should respond
  prohibited_topics TEXT[], -- Topics to avoid
  escalation_triggers TEXT[], -- When to hand off to human
  
  -- Additional context
  custom_instructions TEXT, -- Free-form additional instructions
  knowledge_base JSONB, -- Additional structured knowledge
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- One default per organization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(organization_id, name)
);

-- 2. Bot context assignments (which bots use which contexts)
CREATE TABLE bot_context_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  context_id UUID NOT NULL REFERENCES business_contexts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0, -- For multiple contexts, higher = more important
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(bot_id, context_id)
);

-- 3. Context templates for quick setup
CREATE TABLE context_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL, -- Pre-filled context data
  use_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_business_contexts_org ON business_contexts(organization_id);
CREATE INDEX idx_business_contexts_active ON business_contexts(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_business_contexts_default ON business_contexts(organization_id, is_default) WHERE is_default = true;
CREATE INDEX idx_bot_context_assignments_bot ON bot_context_assignments(bot_id);
CREATE INDEX idx_bot_context_assignments_context ON bot_context_assignments(context_id);
CREATE INDEX idx_context_templates_type ON context_templates(business_type);

-- Create trigger for updated_at
CREATE TRIGGER update_business_contexts_updated_at BEFORE UPDATE ON business_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default context per organization
CREATE OR REPLACE FUNCTION ensure_single_default_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE business_contexts 
    SET is_default = false 
    WHERE organization_id = NEW.organization_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_context_trigger
BEFORE INSERT OR UPDATE ON business_contexts
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_context();

-- Insert some default templates
INSERT INTO context_templates (name, business_type, description, template_data) VALUES
(
  'Real Estate Agency',
  'real_estate',
  'Template for real estate agencies and brokers',
  '{
    "business_type": "real_estate",
    "tone_of_voice": "professional",
    "language_style": "conversational",
    "services_offered": ["Property buying", "Property selling", "Property management", "Real estate consultation"],
    "response_guidelines": [
      "Always be helpful and informative about property details",
      "Offer to schedule property viewings",
      "Provide market insights when relevant",
      "Emphasize local expertise"
    ],
    "escalation_triggers": [
      "Legal questions",
      "Specific pricing negotiations",
      "Contract details"
    ]
  }'::jsonb
),
(
  'Dental Practice',
  'dental',
  'Template for dental clinics and practices',
  '{
    "business_type": "dental",
    "tone_of_voice": "friendly",
    "language_style": "conversational",
    "services_offered": ["General dentistry", "Teeth cleaning", "Fillings", "Crowns", "Emergency dental care"],
    "response_guidelines": [
      "Be reassuring about dental procedures",
      "Emphasize pain-free and comfortable experience",
      "Offer appointment scheduling",
      "Provide general dental health tips"
    ],
    "escalation_triggers": [
      "Medical emergencies",
      "Specific treatment recommendations",
      "Insurance coverage details"
    ]
  }'::jsonb
),
(
  'Fitness Studio',
  'fitness',
  'Template for gyms and fitness studios',
  '{
    "business_type": "fitness",
    "tone_of_voice": "energetic",
    "language_style": "casual",
    "services_offered": ["Personal training", "Group classes", "Nutrition counseling", "Fitness assessments"],
    "response_guidelines": [
      "Be motivating and encouraging",
      "Highlight success stories",
      "Offer free trials or consultations",
      "Emphasize community and support"
    ],
    "escalation_triggers": [
      "Medical conditions",
      "Injury concerns",
      "Specific program customization"
    ]
  }'::jsonb
);

-- RLS Policies
ALTER TABLE business_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_context_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_templates ENABLE ROW LEVEL SECURITY;

-- Business contexts policies
CREATE POLICY "Users can view their organization's contexts" ON business_contexts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create contexts for their organization" ON business_contexts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can update their organization's contexts" ON business_contexts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can delete their organization's contexts" ON business_contexts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator')
    )
  );

-- Bot context assignments policies
CREATE POLICY "Users can view their organization's assignments" ON bot_context_assignments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's assignments" ON bot_context_assignments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

-- Templates are public
CREATE POLICY "Anyone can view public templates" ON context_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create templates" ON context_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);