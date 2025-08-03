-- 015_bot_specific_context.sql
-- Refactor business contexts to be bot-specific

-- Drop the old tables and constraints
DROP TABLE IF EXISTS bot_context_assignments CASCADE;
DROP TABLE IF EXISTS business_contexts CASCADE;
DROP TABLE IF EXISTS context_templates CASCADE;

-- 1. Bot contexts table (linked to specific bots)
CREATE TABLE bot_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Core business information
  business_name TEXT NOT NULL,
  business_type TEXT, -- e.g., 'real_estate', 'dental', 'fitness', 'consulting'
  industry TEXT,
  
  -- Business details
  services_offered TEXT[], -- Array of services
  target_audience TEXT,
  unique_value_proposition TEXT,
  
  -- Communication preferences
  tone_of_voice TEXT DEFAULT 'professional', -- e.g., 'professional', 'friendly', 'casual', 'authoritative'
  language_style TEXT DEFAULT 'conversational', -- e.g., 'formal', 'conversational', 'technical'
  
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(bot_id) -- One context per bot
);

-- 2. Context templates for quick setup
CREATE TABLE bot_context_templates (
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
CREATE INDEX idx_bot_contexts_bot ON bot_contexts(bot_id);
CREATE INDEX idx_bot_contexts_org ON bot_contexts(organization_id);
CREATE INDEX idx_bot_context_templates_type ON bot_context_templates(business_type);

-- Create trigger for updated_at
CREATE TRIGGER update_bot_contexts_updated_at BEFORE UPDATE ON bot_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default templates
INSERT INTO bot_context_templates (name, business_type, description, template_data) VALUES
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
),
(
  'E-commerce Store',
  'ecommerce',
  'Template for online retail businesses',
  '{
    "business_type": "ecommerce",
    "tone_of_voice": "friendly",
    "language_style": "conversational",
    "services_offered": ["Online shopping", "Product recommendations", "Order tracking", "Customer support"],
    "response_guidelines": [
      "Help customers find the right products",
      "Provide detailed product information",
      "Assist with order issues",
      "Offer personalized recommendations"
    ],
    "escalation_triggers": [
      "Payment issues",
      "Refund requests",
      "Complex technical problems"
    ]
  }'::jsonb
),
(
  'SaaS Company',
  'saas',
  'Template for software as a service companies',
  '{
    "business_type": "saas",
    "tone_of_voice": "professional",
    "language_style": "technical",
    "services_offered": ["Software solutions", "Technical support", "Implementation assistance", "Training"],
    "response_guidelines": [
      "Explain features clearly",
      "Provide helpful documentation links",
      "Offer demos and trials",
      "Address technical questions accurately"
    ],
    "escalation_triggers": [
      "Billing issues",
      "Advanced technical problems",
      "Enterprise requirements"
    ]
  }'::jsonb
);

-- RLS Policies
ALTER TABLE bot_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_context_templates ENABLE ROW LEVEL SECURITY;

-- Bot contexts policies
CREATE POLICY "Users can view their organization's bot contexts" ON bot_contexts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bot contexts for their organization" ON bot_contexts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can update their organization's bot contexts" ON bot_contexts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator', 'member')
    )
  );

CREATE POLICY "Users can delete their organization's bot contexts" ON bot_contexts
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'administrator')
    )
  );

-- Templates are public
CREATE POLICY "Anyone can view public templates" ON bot_context_templates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create templates" ON bot_context_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);