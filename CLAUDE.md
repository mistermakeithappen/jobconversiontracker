# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered workflow automation platform - a Make.com competitor that uses natural language to generate complete workflows. The project consists of two main parts:

1. **Root directory**: Basic Supabase setup and REF MCP configuration
2. **workflow-automation/**: Main Next.js application with comprehensive automation features

## Key Commands

### Development
```bash
# Main application (run from workflow-automation/ directory)
npm run dev              # Start development server with Turbopack
npm run build           # Build for production
npm run lint            # Run ESLint
npm run start           # Start production server

# Database operations
npm run setup-db        # Run database migrations  
npm run create-mock-user # Create mock user for development
npm run init-db         # Check database initialization status
```

### Testing
```bash
# No formal test framework configured yet
# Use manual testing via development server

# Debug/Development endpoints
npm run dev  # Then visit /developer for development tools
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15.4.4, React 19, TypeScript, TailwindCSS 4, React Flow
- **Authentication**: Clerk (currently bypassed with mock auth for development)
- **Database**: Supabase (PostgreSQL with RLS)
- **Payments**: Stripe (configured but not active)
- **Deployment**: Vercel
- **AI Integrations**: OpenAI GPT-4 Vision, User's own API keys (BYOK model)

### Project Structure
```
workflow-automation/
├── app/
│   ├── (authenticated)/    # Protected routes with mock auth
│   │   ├── dashboard/      # User dashboard
│   │   ├── workflows/      # Workflow management & React Flow builder
│   │   ├── executions/     # Execution history & logs
│   │   ├── integrations/   # GoHighLevel OAuth & settings
│   │   ├── ghl/           # GHL-specific pages (contacts, opportunities, receipts)
│   │   ├── settings/       # Payment structures, API keys, credit cards
│   │   ├── developer/      # Development tools and testing endpoints
│   │   └── test-receipt-ai/ # AI receipt processing test page
│   └── api/               # API routes (extensive integration endpoints)
├── components/
│   ├── ui/                # Reusable UI components
│   ├── workflow-builder/  # React Flow workflow builder
│   └── ghl/              # GoHighLevel-specific components
├── lib/
│   ├── auth/             # Mock authentication system
│   ├── supabase/         # Database client (both anon & service role)
│   ├── integrations/     # GoHighLevel OAuth & API client
│   ├── utils/            # Encryption, file conversion, API key management
│   └── workflow-execution/ # Workflow execution engine
├── scripts/              # Database setup and migration scripts
└── supabase/
    └── migrations/       # Database schema migrations (20+ files)
```

## Critical Development Context

### Authentication System (Important!)
- **Current State**: Using mock authentication for development
- **Mock User ID**: `af8ba507-b380-4da8-a1e2-23adee7497d5`
- **Files**: `lib/auth/mock-auth.tsx`, `lib/auth/mock-auth-server.ts`
- **Database Access**: Uses service role key to bypass RLS in API routes
- **TODO**: Replace with Clerk auth and update RLS policies

### Database Configuration
- **Supabase Project**: `hmulhwnftlsezkjuflxm`
- **RLS**: Enabled but bypassed via service role key in development
- **Key Tables**: users, workflows, executions, integrations, opportunity_receipts, time_entries, user_api_keys
- **Migration Pattern**: Extensive migration system (20+ files) - always run in order

### GoHighLevel Integration (Production-Ready)
- **OAuth 2.0**: Complete implementation with encrypted token storage
- **API Client**: `lib/integrations/gohighlevel/client.ts` with automatic token refresh
- **Restrictions**: Cannot use "ghl" or "highlevel" in OAuth redirect URLs
- **Endpoints**: All use `/api/integrations/automake/` prefix due to GHL restrictions
- **Features**: Contacts, opportunities with real-time data, receipt tracking, time tracking

### AI Receipt Processing System
- **BYOK Model**: Users provide their own OpenAI API keys
- **Vision API**: Extracts vendor, amount, date, description from receipt images
- **Job Matching**: Intelligent matching to GoHighLevel opportunities
- **File Support**: JPEG, PNG, WebP, TIFF, HEIC, PDF with automatic PNG conversion
- **API**: `/api/receipts/process-image` for uploads, `/api/receipts/process-from-message` for SMS
- **Dependencies**: Sharp, pdf2pic for file conversion

## Development Patterns

### API Routes
- All use service role Supabase client: `getServiceSupabase()`
- Authentication via `mockAuthServer()` from `mock-auth-server.ts`
- Comprehensive error handling with proper HTTP status codes
- Integration-specific endpoints under `/api/integrations/`

### Database Operations
- Service role key bypasses RLS for development
- Extensive migration system - always run migrations in chronological order
- Foreign key constraints removed for mock auth compatibility
- Row-level security policies prepared for production auth

### Component Architecture
- Mock auth context provided by `MockAuthProvider`
- Supabase client operations through `lib/supabase/client.ts`
- React Flow for workflow visualization
- Comprehensive integration with GoHighLevel APIs

## Important Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hmulhwnftlsezkjuflxm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk (not active during development)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# GoHighLevel OAuth
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=

# Encryption for secure storage
ENCRYPTION_KEY= # Generate with: openssl rand -base64 32

# OpenAI (optional - users can provide their own)
OPENAI_API_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Common Development Issues & Solutions

### Database Issues
- **Time Entries FK Constraint**: Remove foreign key to auth.users for mock auth
- **Missing Columns**: Run latest migrations for schema updates
- **RLS Bypass**: Use service role key in API routes during development

### GoHighLevel Integration
- **Pagination**: Use `startAfterId`, not `offset` for API pagination
- **URL Restrictions**: Cannot use "ghl" or "highlevel" in OAuth URLs
- **Token Refresh**: Automatic refresh 5 minutes before expiration

### File Processing
- **Receipt Processing**: Always convert to PNG before OpenAI Vision API using `FileConverter` utility
- **Large Files**: 10MB limit with proper validation
- **PDF Support**: First page only extraction for receipts via pdf2pic
- **Supported Formats**: JPEG, PNG, WebP, TIFF, HEIC, PDF

### API Key Management
- **Encryption**: AES-256-GCM for all stored API keys
- **BYOK Model**: Users provide their own OpenAI/Anthropic keys
- **Validation**: Real-time validation when adding new keys

## Deployment Notes
- **Target**: Vercel deployment
- **Database**: Supabase cloud (production ready)
- **Authentication**: Will need Clerk integration for production
- **File Storage**: Supabase storage for receipt images
- **Environment**: Configured for Vercel deployment

## Integration Status
- ✅ GoHighLevel OAuth 2.0 (production-ready)
- ✅ AI Receipt Processing with OpenAI Vision
- ✅ Time Tracking with Payment Structures
- ✅ Workflow Execution Engine
- ✅ React Flow Workflow Builder
- 🔄 Clerk Authentication (mock auth currently)
- 🔄 Stripe Billing (configured but inactive)
- 🔄 Additional integrations (Notion, JotForm planned)

## Key Learning: claude-reminders.md
Always check `workflow-automation/claude-reminders.md` for documented solutions to common issues encountered during development. This file contains specific problem-solution pairs for database constraints, API validation, and integration challenges.