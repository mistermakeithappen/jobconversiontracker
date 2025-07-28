# Product Requirements Document (PRD)
## AI-Powered Workflow Automation Platform

### Document Information
- **Version:** 2.0 (Supabase & Clerk Architecture)
- **Date:** January 2025
- **Status:** Draft
- **Owner:** Product Team

---

## Executive Summary

### Product Vision
Build a Make.com competitor that democratizes workflow automation through AI. Users describe their automation needs in plain English, and our AI generates complete, functional workflows instantly.

### Key Differentiators
- **AI-First Approach:** Natural language to workflow generation
- **Transparent Pricing:** $30/month for 15,000 executions (no rollover)
- **BYOK Model:** Users bring their own API keys (OpenAI/Anthropic)
- **Visual & Code:** Both drag-and-drop builder and AI generation
- **Version Control:** Track and rollback workflow changes

### Success Metrics
- User acquisition: 1,000 paid users in 6 months
- Workflow creation time: 80% reduction vs competitors
- User retention: 85% monthly retention rate
- NPS Score: > 50

---

## Product Overview

### Problem Statement
Current workflow automation platforms require technical knowledge and significant time investment to create even simple automations. Users struggle with:
- Complex visual builders requiring deep understanding of data flow
- Expensive pricing with unused credits
- Steep learning curves for non-technical users
- Limited AI assistance in workflow creation
- Limited API endpoints for GHL

### Solution
An AI-powered platform that:
- Generates complete workflows from natural language descriptions
- Provides transparent, affordable pricing
- Offers both AI generation and visual editing
- Includes built-in version control
- Supports popular integrations out of the box. Version 1 will integrate GHL and Notion

---

## Target Users

### Primary Persona: Small Business Owner
- **Demographics:** 25-45 years old, running service businesses
- **Tech Level:** Basic to intermediate
- **Pain Points:**
  - Spending hours on repetitive tasks
  - Can't afford expensive automation consultants
  - Intimidated by complex automation tools
- **Goals:** Automate client onboarding, invoicing, and communications

### Secondary Persona: Freelancer/Consultant
- **Demographics:** 22-40 years old, solo or small team
- **Tech Level:** Intermediate
- **Pain Points:**
  - Manual data entry between tools
  - Inconsistent client processes
  - Time wasted on admin tasks
- **Goals:** Streamline operations to focus on billable work

### Tertiary Persona: Agency Operations Manager
- **Demographics:** 28-50 years old, managing 5-50 person teams
- **Tech Level:** Intermediate to advanced
- **Pain Points:**
  - Complex multi-tool workflows
  - Difficulty training team on automations
  - High automation platform costs
- **Goals:** Standardize processes across team and clients

---

## Core Features

### 1. AI Workflow Generation

#### Description
Users describe their automation needs in plain English, and AI generates a complete workflow.

#### User Stories
- As a user, I can describe my workflow in natural language
- As a user, I can see the AI's interpretation before confirming
- As a user, I can refine the generated workflow with follow-up instructions

#### Acceptance Criteria
- AI responds within 5 seconds
- Generated workflows are immediately executable
- Users can iterate on generation with additional prompts
- System provides explanation of generated workflow

#### Technical Requirements
- Integration with all OpenAI and Anthropic Claude models
- Natural language processing for intent extraction
- Workflow validation before presentation
- Contextual understanding of previous modules

### 2. Visual Workflow Builder

#### Description
Drag-and-drop interface for creating and editing workflows visually.

#### User Stories
- As a user, I can drag modules from a library onto a canvas
- As a user, I can connect modules by drawing connections
- As a user, I can configure each module's settings
- As a user, I can test individual modules

#### Acceptance Criteria
- Canvas supports 50+ modules without performance degradation
- Real-time validation of connections
- Undo/redo functionality
- Zoom and pan controls
- Mini-map for navigation

#### Technical Requirements
- React Flow for canvas rendering
- Supabase Realtime for collaborative editing
- Efficient state management for large workflows
- Module library with search and categories

### 3. Billing & Subscription Management

#### Description
Stripe-integrated billing with transparent credit system, user management through Clerk.

#### User Stories
- As a user, I can subscribe for $30/month
- As a user, I can see my remaining credits
- As a user, I can view execution history
- As a user, I receive alerts before credits expire

#### Acceptance Criteria
- Subscription activates immediately after payment
- Credits reset monthly (no rollover)
- Real-time credit tracking
- Overage charges at $0.002 per execution
- Clear billing history and invoices

#### Technical Requirements
- Stripe subscription integration
- Clerk webhook for user creation events
- Supabase Edge Functions for payment webhooks
- Real-time credit tracking with Supabase subscriptions
- Automated invoice generation

### 4. Integration Library

#### Initial Integrations (Launch)

**GoHighLevel V2**
- Create/update contacts
- Generate invoices
- Send emails
- Manage opportunities

**Notion API**
- Create/update database items
- Create pages
- Query databases
- Update properties

**JotForm**
- Webhook triggers
- Form submission data
- File handling
- Response mapping

**Browse AI**
- Trigger automations
- Retrieve scraped data
- Monitor changes
- Webhook notifications

**AI Providers**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Custom prompts
- Response parsing

#### Integration Requirements
- Standardized module interface
- OAuth where available (stored in Supabase)
- Encrypted API key storage (Supabase Vault)
- Rate limit handling
- Error recovery

### 5. Version Control

#### Description
Track workflow changes with ability to view and restore previous versions.

#### User Stories
- As a user, I can see version history for my workflows
- As a user, I can compare versions
- As a user, I can restore previous versions
- As a user, I can add notes to versions

#### Acceptance Criteria
- Last 5 versions stored
- Visual diff between versions
- One-click restore
- Version metadata (date, changes, author)
- Automatic versioning on save

#### Technical Requirements
- Supabase JSON storage for workflow versions
- Diff algorithm for version comparison
- Soft delete pattern for version management

### 6. Execution Engine

#### Description
Reliable, scalable system for executing workflows using Supabase Edge Functions.

#### Requirements
- Support for parallel execution
- Retry logic with exponential backoff
- Detailed execution logs
- Error handling and notifications
- Webhook endpoints for triggers
- Scheduling capability with pg_cron

---

## User Experience

### Information Architecture
```
Home
├── Dashboard
│   ├── Recent Workflows
│   ├── Execution Stats
│   └── Quick Actions
├── Workflows
│   ├── My Workflows (List/Grid view)
│   ├── Create New
│   │   ├── AI Generator
│   │   └── Visual Builder
│   └── Templates
├── Executions
│   ├── History
│   ├── Logs
│   └── Analytics
├── Integrations
│   ├── Connected
│   ├── Available
│   └── API Keys
└── Account
    ├── Profile (Clerk)
    ├── Billing
    ├── Usage
    └── Settings
```

### Key User Flows

#### 1. AI Workflow Creation
1. User clicks "Create with AI"
2. Modal appears with text input
3. User describes workflow in natural language
4. AI generates workflow preview
5. User can modify or accept
6. Workflow saved and ready to activate

#### 2. Visual Workflow Creation
1. User clicks "Create Manually"
2. Canvas opens with module library
3. User drags trigger module
4. User adds action modules
5. User connects modules
6. User configures each module
7. User saves and activates

#### 3. First-Time Setup
1. User signs up (Clerk)
2. Clerk webhook creates user profile in Supabase
3. Billing setup (Stripe checkout)
4. Onboarding flow
5. Connect first integration
6. Create first workflow (guided)
7. Test execution
8. Dashboard with next steps

### Design Principles
- **Simplicity First:** Every feature should be immediately understandable
- **Progressive Disclosure:** Advanced features revealed as needed
- **Visual Feedback:** Clear status indicators and progress
- **Helpful Errors:** Actionable error messages with solutions
- **Mobile Responsive:** Core features work on tablet/mobile

---

## Technical Architecture

### System Components
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐
│   React SPA     │────▶│  Supabase API   │────▶│    Clerk    │
└─────────────────┘     └─────────────────┘     └─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐         ┌────▼────┐
              │PostgreSQL │         │  Redis  │
              │(Supabase) │         │(Upstash)│
              └───────────┘         └─────────┘
                    │
              ┌─────▼─────┐
              │   Edge    │
              │ Functions │
              └───────────┘
```

### Technology Stack
- **Frontend:** React 18, TypeScript, TailwindCSS, React Flow
- **Authentication:** Clerk (handles user management, SSO, MFA)
- **Backend:** Supabase (PostgreSQL, Realtime, Edge Functions, Storage)
- **Caching:** Upstash Redis (for rate limiting, execution queues)
- **Infrastructure:** Vercel (Frontend), Supabase Cloud
- **Monitoring:** Sentry, Vercel Analytics
- **CI/CD:** GitHub Actions

### Database Schema (Supabase)
```sql
-- Users table (synced from Clerk via webhook)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_status TEXT,
  stripe_customer_id TEXT
);

-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow versions
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id),
  version_number INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Executions table
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id),
  user_id UUID REFERENCES users(id),
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  logs JSONB,
  error TEXT
);

-- API Keys (encrypted)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  service TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own workflows"
  ON workflows FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own executions"
  ON executions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own API keys"
  ON api_keys FOR ALL
  USING (auth.uid() = user_id);
```

### API Design (Supabase Edge Functions)

#### Edge Function Endpoints
```
POST   /functions/v1/workflows                 # Create workflow
GET    /functions/v1/workflows                 # List workflows
GET    /functions/v1/workflows/{id}           # Get workflow
PUT    /functions/v1/workflows/{id}           # Update workflow
DELETE /functions/v1/workflows/{id}           # Delete workflow
POST   /functions/v1/workflows/{id}/execute   # Manual execution
GET    /functions/v1/workflows/{id}/versions  # Get versions

POST   /functions/v1/ai/generate              # Generate workflow
POST   /functions/v1/ai/suggest               # Get suggestions

GET    /functions/v1/executions               # Execution history
GET    /functions/v1/executions/{id}          # Execution details

POST   /functions/v1/webhooks/stripe          # Stripe webhooks
POST   /functions/v1/webhooks/clerk           # Clerk webhooks
POST   /functions/v1/webhooks/{integration}   # Integration webhooks
```

---

## Security Requirements
- Clerk handles authentication (JWT, SSO, MFA)
- Supabase RLS for data isolation
- API rate limiting via Upstash Redis
- Encrypted API key storage (Supabase Vault)
- Webhook signature validation
- Input sanitization in Edge Functions
- CORS configuration
- SSL/TLS by default

---

## Performance Requirements
- Page load: < 2 seconds
- API response: < 200ms
- Workflow execution start: < 1 second
- 99.9% uptime SLA
- Support 10,000 concurrent users
- Handle 1M executions/day

---

## Launch Strategy

### MVP Features (8 weeks)
1. Clerk authentication setup
2. Stripe billing integration
3. AI workflow generation
4. Basic visual builder
5. 5 core integrations
6. Execution engine (Edge Functions)
7. Basic analytics

### Phase 2 Features (4 weeks)
1. Advanced visual builder
2. Version control
3. Template library
4. Team collaboration (Clerk organizations)
5. Advanced analytics
6. Mobile app

---

## Go-to-Market Strategy

### Pricing

#### Starter: $30/month
- 15,000 executions
- All integrations
- Version control
- Email support

#### Growth: $99/month (future)
- 100,000 executions
- Priority support
- Advanced analytics
- Team seats (Clerk organizations)

#### Enterprise: Custom (future)
- Unlimited executions
- SLA
- Custom integrations
- Dedicated support
- SSO (via Clerk)

### Marketing Channels

#### Content Marketing
- SEO-optimized tutorials
- YouTube automation guides
- Comparison articles

#### Product-Led Growth
- Free tier (future)
- Template marketplace
- Referral program

#### Partnerships
- Integration partners
- Agency partnerships
- Consultant network

---

## Success Metrics

### Business Metrics
- MRR growth: 20% month-over-month
- CAC payback: < 3 months
- LTV:CAC ratio: > 3:1
- Gross margin: > 80%

### Product Metrics
- Activation rate: 60% create first workflow
- Feature adoption: 40% use AI generation
- Workflow success rate: > 95%
- Time to first workflow: < 10 minutes

### Technical Metrics
- Uptime: 99.9%
- Response time: p95 < 200ms
- Error rate: < 0.1%
- Execution success: > 99%

---

## Risk Mitigation

### Technical Risks
- **Supabase Limits:** Monitor usage, implement caching
- **Scale Issues:** Edge Function optimization, queue management
- **Integration Failures:** Retry logic, notifications

### Business Risks
- **Competition:** Focus on AI differentiation
- **Pricing Pressure:** Value-based positioning
- **Churn:** Onboarding optimization, success team

### Compliance Risks
- **Data Privacy:** GDPR compliance via Supabase regions
- **API Terms:** Respect rate limits, terms of service
- **Payment Security:** PCI compliance via Stripe

---

## Implementation Notes

### Clerk Integration
- Use Clerk React for frontend auth
- Webhook sync to Supabase users table
- Organization support for teams
- Custom claims for subscription status

### Supabase Architecture
- Edge Functions for all business logic
- Realtime subscriptions for live updates
- Storage for workflow assets
- pg_cron for scheduled executions

### Development Workflow
- Local Supabase instance for development
- Preview deployments on Vercel
- Staging environment on Supabase
- Production deployment process

---

## Appendices

### A. Competitive Analysis
- **Make.com:** Complex but powerful, expensive
- **Zapier:** Market leader, very expensive
- **n8n:** Open source, requires hosting
- **Activepieces:** New player, limited integrations

### B. Technical Specifications
[Link to detailed Supabase schema and Edge Functions docs]

### C. Design Mockups
[Link to Figma designs]

### D. Financial Projections
[Link to financial model]

---

## Approval & Sign-off
- Product Manager: _________________ Date: _______
- Engineering Lead: _________________ Date: _______
- Design Lead: _________________ Date: _______
- CEO/Founder: _________________ Date: _______