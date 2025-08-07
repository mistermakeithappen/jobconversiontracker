# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered workflow automation platform - a Make.com competitor using natural language to generate complete workflows. Built with Next.js, Supabase, and React Flow.

**Project Structure**:
- **Root directory**: Supabase setup and REF MCP configuration
- **workflow-automation/**: Main Next.js application

## Key Commands

### Development (run from workflow-automation/)
```bash
npm run dev              # Start dev server (port 3000)
npm run build           # Production build
npm run lint            # ESLint check
npm run typecheck       # TypeScript check
npm run start           # Production server

# Database setup
npm run setup-db        # Run all migrations in order
npm run init-db         # Check database status

# Development with ngrok
npm run dev:tunnel      # Start dev server with ngrok tunnel
```

### Testing Endpoints
```bash
# Manual testing via development server
npm run dev
# Visit: /developer - Development tools
# Visit: /test-receipt-ai - AI receipt processing test
# Visit: /chatbot - MCP integration testing interface
# Visit: /ghl - Main dashboard (default after login)
# Visit: /ghl/receipts - Receipt management with reimbursement tracking
# Visit: /ghl/sales/products - Product catalog and commission settings
# Visit: /ghl/sales/analytics - Product performance analytics
# Visit: /ghl/sales/leaderboard - Sales gamification and challenges
```

## Architecture & Tech Stack

- **Frontend**: Next.js 15.4.4, React 19, TypeScript, TailwindCSS 4, React Flow
- **Auth**: Clerk Authentication (production-ready)
- **Database**: Supabase PostgreSQL with RLS (Project: `hmulhwnftlsezkjuflxm`)
- **AI**: OpenAI GPT-4 Vision (BYOK model - users provide API keys)
- **Payments**: Stripe (configured, not active)
- **Integrations**: GoHighLevel OAuth 2.0 (production-ready)
- **Deployment**: Vercel-ready configuration

## Recent Development Status (August 2025)

### New Features Added
- **SMS Receipt Processing**: Complete receipt capture via SMS with AI extraction and job matching
- **Reimbursement Tracking**: Mark receipts as paid with filtering by status (pending/reimbursed/company card)
- **Product Commission System**: Recurring revenue tracking, MRR commissions, and product-based rules
- **Product Performance Analytics**: Sales velocity, conversion rates, and revenue tracking dashboards
- **Gamification System**: Sales leaderboards, challenges, and achievement tracking
- **MCP (Model Context Protocol) Support**: Added GHL MCP integration at `/api/mcp/ghl/` for enhanced Claude interactions
- **Personal Assistant Chatbot**: GPT-4 powered assistant using MCP for intelligent GHL operations and platform user support
- **Custom Bot Builder**: Node-based visual bot designer allowing users to create and deploy custom chatbots with specific tools and goals
- **Pipeline Analysis System**: Automated pipeline stage analysis with timestamps
- **Sales Tracking System**: Complete sales, products, commissions, and payouts management
- **Unified Commission System**: Consolidated commission tracking across opportunities and sales
- **Business Context System**: Bot-specific context for enhanced chatbot capabilities
- **Calendar Integration**: Full GHL calendar and appointment management
- **Debug Tools**: Added `/api/debug/` endpoints for troubleshooting

### Latest API Routes Added
- `/api/receipts/process-from-message/` - AI receipt processing from SMS attachments
- `/api/receipts/[id]/reimburse/` - Mark receipts as reimbursed
- `/api/receipts/confirm-assignment/` - Confirm job assignment for receipts
- `/api/webhooks/ghl/messages/` - Incoming SMS webhook handler
- `/api/webhooks/ghl/messages/confirm-receipt/` - Receipt confirmation conversation handler
- `/api/commissions/` - Complete commission management system
- `/api/payouts/` - Payout generation and export functionality
- `/api/sales/` - Sales transaction tracking and payment sync
- `/api/products/` - Product catalog synchronization
- `/api/pipelines/` - Pipeline analysis and stage management
- `/api/mcp/ghl/` - MCP integration for GoHighLevel
- `/api/ghl/user-commissions/` - GHL-specific commission calculations
- `/api/chatbot/chat/` - AI-powered chatbot with MCP integration
- `/api/bots/` - Bot management and configuration
- `/api/bot-context-templates/` - Business context templates

## Critical Development Context

### Development Guidelines
- No workarounds. Just figure out how to do this properly by testing but no workarounds. This is a PRODUCTION WORTHY build only.
- Always check for existing database tables/columns before creating new ones
- Use process of elimination for debugging, never create workarounds
- Maintain production-ready code quality at all times

### Authentication Flow
- **Current**: Clerk Authentication fully implemented
- **Auth Flow**: Signup → Create organization → Create user → Create membership
- **API Routes**: All use Clerk authentication via middleware
- **Database**: users table syncs with Clerk, organizations provide multi-tenancy

### Database Patterns
- **Service Role**: All API routes use `getServiceSupabase()` to bypass RLS
- **Migrations**: Run chronologically from `supabase/migrations/` (see MIGRATION_ORDER.md)
- **Multi-tenancy**: All data is organization-scoped
- **Key Tables**: 
  - **Core**: users, organizations, organization_members, workflows, executions, integrations
  - **GHL**: opportunity_receipts, time_entries, contacts, pipeline_stages, ghl_calendars
  - **Sales**: sales_transactions, ghl_products, commission_calculations, commission_payouts
  - **Chatbot**: bots, bot_context_templates, conversation_sessions, chat_sessions
  - **Bot Builder**: workflow_nodes, workflow_connections, bot_workflows, workflow_goal_evaluations, workflow_actions_log
  - **MCP**: mcp_integrations, mcp_tools, mcp_tool_executions

### GoHighLevel Integration
- **OAuth**: Complete implementation at `/api/integrations/automake/` (GHL restricts "ghl"/"highlevel" in URLs)
- **API Client**: `lib/integrations/gohighlevel/client.ts` with auto token refresh
- **Features**: Contacts, opportunities, receipts, time tracking, commission tracking, calendars
- **Pagination**: Use `startAfterId`, NOT `offset`
- **Required Scopes**: calendars.readonly/write, tags.readonly/write, custom-fields.readonly/write

### AI Receipt Processing
- **Endpoints**: 
  - `/api/receipts/process-image` - Web uploads with instant processing
  - `/api/receipts/process-from-message` - SMS attachments with conversational flow
  - `/api/receipts/confirm-assignment` - Confirm job assignment via SMS response
- **SMS Flow**:
  1. Team member texts receipt image to GHL number
  2. System verifies sender is registered team member (via phone in team_members table)
  3. AI extracts receipt data including vendor, amount, date, payment method
  4. System finds opportunities assigned to that team member
  5. Sends SMS with job matching options (numbered list or YES confirmation)
  6. Team member responds to confirm assignment
  7. Receipt created with automatic reimbursable status based on card detection
- **File Support**: JPEG, PNG, WebP, TIFF, HEIC, PDF (auto-converts to PNG)
- **Dependencies**: Sharp, pdf2pic for conversions
- **Limit**: 10MB per file
- **Reimbursement Tracking**: Three-tab view (Pending/Reimbursed/Company Card) with mark as paid functionality

### Sales Tracking System
- **Tables**: sales_transactions, ghl_products, commission_structures, commission_rules
- **Features**: Product sync, commission calculation, payout tracking, rule-based commissions
- **API Routes**: `/api/sales/*`, `/api/products/*`, `/api/commissions/*`, `/api/payouts/*`
- **Dashboard**: `/ghl/sales` - comprehensive sales management interface
- **Commission Types**: One-off, MRR, duration-based, trailing commissions

### MCP Integration System (Personal Assistant)
- **Purpose**: Model Context Protocol support for the platform's personal assistant chatbot
- **API Routes**: `/api/mcp/ghl/*` - GHL-specific MCP tools and integrations
- **Tools**: All 21 official GoHighLevel MCP tools implemented and tested
- **Components**: `components/ghl/mcp-settings.tsx` for configuration
- **Client**: `lib/mcp/ghl-mcp-client.ts` - Full MCP client with SSE support
- **Testing**: Comprehensive test interface at `/chatbot` with all 21 tools
- **Personal Assistant**: AI-powered assistant using MCP for real GHL operations and platform support

### Custom Bot Builder System
- **Purpose**: Visual node-based bot designer for creating custom chatbots
- **Architecture**: Modular system where users design workflows with nodes representing different tools and goals
- **Node Types**: 
  - **Tool Nodes**: Specific actions (send message, create contact, update opportunity, etc.)
  - **Goal Nodes**: Business objectives (qualify lead, schedule appointment, collect information)
  - **Logic Nodes**: Conditions, branches, and decision points
- **Deployment**: Users can deploy custom bots to handle customer messaging across different channels
- **Use Cases**: Lead qualification, appointment scheduling, customer support, sales automation
- **Tables**: workflow_nodes, workflow_connections, bot_workflows, workflow_goal_evaluations
- **Components**: `components/workflow-builder/BotWorkflowBuilder.tsx`, `components/workflow-builder/nodes/`
- **Flexibility**: Super modular design allows businesses to create bots tailored to their specific needs

## Development Patterns

### API Route Structure
```typescript
// Standard pattern for all API routes
export async function GET/POST(request: Request) {
  const supabase = getServiceSupabase()  // Service role client
  const { userId, organizationId } = await auth()  // Clerk authentication
  
  // Validate request...
  // Database operations...
  // Return NextResponse.json()
}
```

### Common Issues & Solutions

**Database FK Constraints**: Remove foreign keys to auth.users for Clerk auth compatibility
**Missing Columns**: Run latest migrations - check `supabase/migrations/` directory
**GHL User IDs**: Use VARCHAR, not UUID - they're strings from GoHighLevel
**Receipt Processing**: 
  - Always convert to PNG before OpenAI Vision API
  - Team members must be in team_members table with phone number
  - Organization must have OpenAI API key configured
  - Check opportunity_cache has data before testing SMS flow
**SMS Receipt Flow**:
  - Webhook must receive from registered team member phone
  - Opportunities must be assigned to team member's ghl_user_id
  - Response matching is flexible: number (1,2,3), YES, or job name
**API Validation**: Frontend and backend validation must match exactly
**RLS Policies**: Disable RLS on pipeline_stages table for proper GHL data access
**Commission Calculations**: Use unified commission system, avoid duplicating rules
**MCP Integration**: Ensure proper tool registration and JSON-RPC 2.0 format
**GHL API Scopes**: Add required scopes before implementing features (user must reconnect)

## MCP Integration Troubleshooting (CRITICAL)

### GoHighLevel MCP Server Setup
- **Endpoint**: `https://services.leadconnectorhq.com/mcp/`
- **Authentication**: Bearer token with Private Integration Token (PIT)
- **Headers Required**: 
  ```
  Content-Type: application/json
  Accept: application/json, text/event-stream
  Authorization: Bearer <PIT_TOKEN>
  locationId: <LOCATION_ID>
  ```

### Request Format (MUST USE JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "contacts_get-contacts",
    "arguments": { "limit": 5 }
  },
  "id": 1234567890
}
```

### Response Handling (Server-Sent Events)
- **Content-Type**: `text/event-stream` (NOT application/json)
- **Format**: 
  ```
  event: message
  data: {"jsonrpc":"2.0","result":[...],"id":123}
  
  event: done
  data: [DONE]
  ```
- **Parsing**: Must read stream chunk by chunk, extract JSON from `data: ` lines

### Official 21 MCP Tools (VERIFIED WORKING)
**Calendar (2)**: `calendars_get-calendar-events`, `calendars_get-appointment-notes`
**Contacts (8)**: `contacts_get-contacts`, `contacts_get-contact`, `contacts_create-contact`, `contacts_update-contact`, `contacts_upsert-contact`, `contacts_add-tags`, `contacts_remove-tags`, `contacts_get-all-tasks`
**Conversations (3)**: `conversations_search-conversation`, `conversations_get-messages`, `conversations_send-a-new-message`
**Location (2)**: `locations_get-location`, `locations_get-custom-fields`
**Opportunities (4)**: `opportunities_search-opportunity`, `opportunities_get-opportunity`, `opportunities_update-opportunity`, `opportunities_get-pipelines`
**Payments (2)**: `payments_get-order-by-id`, `payments_list-transactions`

### MCP Parameter Naming Convention
- **CRITICAL**: All parameters must be prefixed based on HTTP location:
  - `body_` for request body parameters
  - `path_` for URL path parameters
  - `query_` for URL query parameters
- **Example**: `conversations_send-a-new-message` requires `body_contactId`, `body_message`, `body_type`

## Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hmulhwnftlsezkjuflxm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# GoHighLevel OAuth
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=

# Encryption (generate: openssl rand -base64 32)
ENCRYPTION_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional - users can provide their own
OPENAI_API_KEY=
```

## Chatbot Systems

### 1. Personal Assistant Chatbot (MCP-Based)
- **Purpose**: Platform-wide intelligent assistant for users
- **Technology**: Uses MCP (Model Context Protocol) to interact with GoHighLevel
- **Access**: Available at `/chatbot` for all platform users
- **Capabilities**: 
  - Manages contacts, opportunities, and appointments
  - Sends messages (SMS/Email) via GHL
  - Provides real-time business insights
  - Executes all 21 GHL MCP tools
- **Intelligence**: GPT-4 with function calling for context-aware responses

### 2. Custom Bot Builder (Node-Based)
- **Purpose**: Allows users to design and deploy their own chatbots
- **Technology**: Visual node-based workflow designer (React Flow)
- **Deployment**: Custom bots can be deployed to handle customer messaging
- **Key Features**:
  - **Visual Design**: Drag-and-drop interface for bot creation
  - **Modular Nodes**: Each node represents a specific tool or goal
  - **Business Logic**: Conditions, branches, and decision trees
  - **Multi-Channel**: Deploy to SMS, web chat, social media
  - **Templates**: Pre-built bot templates for common use cases
- **Use Cases**:
  - Lead qualification and nurturing
  - Appointment scheduling and reminders
  - Customer support automation
  - Sales process automation
  - Information collection workflows

## Deployment (Vercel)

### Build Configuration
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: 18.x or higher

### Environment Variables for Vercel
Add all environment variables from `.env.local` to Vercel project settings.

### Build Settings
The project is configured to temporarily ignore ESLint and TypeScript errors during production builds (see `next.config.ts`). Remove these settings once all errors are resolved.

## Key Files & References
- **Known Issues**: `workflow-automation/claude-reminders.md` - solutions to common problems
- **Database Schema**: `workflow-automation/supabase/migrations/` - run in chronological order
- **Migration Order**: `workflow-automation/supabase/migrations/MIGRATION_ORDER.md`
- **Production Setup**: `workflow-automation/PRODUCTION_SETUP.md`
- **GHL Client**: `workflow-automation/lib/integrations/gohighlevel/client.ts`
- **File Converter**: `workflow-automation/lib/utils/file-converter.ts`
- **MCP Client**: `workflow-automation/lib/mcp/ghl-mcp-client.ts`
- **Commission Logic**: Look in `/api/commissions/` for business rules
- **Debug Tools**: Use `/api/debug/` endpoints for troubleshooting

## Integration Status
✅ GoHighLevel OAuth 2.0 & API client
✅ AI Receipt Processing (Web uploads + SMS with conversation)
✅ SMS Receipt Capture & Job Matching
✅ Reimbursement Tracking & Management
✅ Time & Commission Tracking
✅ Sales Management System
✅ Product-based Commission Rules
✅ React Flow Workflow Builder
✅ MCP (Model Context Protocol) Support
✅ Pipeline Analysis & Stage Management
✅ Unified Commission System
✅ Product Catalog & Performance Analytics
✅ Gamification & Sales Leaderboards
✅ Clerk Authentication (production-ready)
✅ AI-Powered Chatbot with MCP
✅ Business Context System
✅ Calendar & Appointment Management
🔄 Stripe Billing (configured, inactive)
📋 Planned: Notion, JotForm integrations