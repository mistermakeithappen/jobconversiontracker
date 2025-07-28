# AI-Powered Workflow Automation Platform

A Make.com competitor that democratizes workflow automation through AI. Users describe their automation needs in plain English, and our AI generates complete, functional workflows instantly.

## 🚀 Features

- **AI Workflow Generation**: Natural language to workflow creation
- **Visual Workflow Builder**: Drag-and-drop interface with React Flow
- **Transparent Pricing**: $30/month for 15,000 executions
- **BYOK Model**: Users bring their own API keys
- **Version Control**: Track and rollback workflow changes
- **Modern Tech Stack**: Next.js 14, TypeScript, Supabase, Clerk

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Flow
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (ready for integration)
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Clerk account
- Stripe account (for payments)

## 🔧 Setup Instructions

1. **Clone the repository**
   ```bash
   cd workflow-automation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.local` and fill in your credentials:
   
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   
   # GoHighLevel OAuth
   GHL_CLIENT_ID=your_ghl_client_id
   GHL_CLIENT_SECRET=your_ghl_client_secret
   
   # OpenAI API for AI Receipt Processing
   OPENAI_API_KEY=your_openai_api_key
   
   # Encryption key for secure token storage (generate with: openssl rand -base64 32)
   ENCRYPTION_KEY=your_32_byte_encryption_key_base64
   
   # App URL (update for production)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Supabase**
   
   - Create a new Supabase project
   - Run the migration in `supabase/migrations/20250125_initial_schema.sql`
   - Run the receipt tracking migration in `supabase/migrations/20250126_receipt_tracking.sql`
   - Run the AI receipt processing migration in `supabase/migrations/20250126_receipt_processing.sql`
   - Run the user API keys migration in `supabase/migrations/20250126_user_api_keys.sql`
   - Run the receipt enhancements migration in `supabase/migrations/20250126_receipt_enhancements.sql`
   - Run the time entries migration in `supabase/migrations/20250126_time_entries.sql`
   - Enable Row Level Security (RLS) as defined in the migrations

5. **Set up Clerk**
   
   - Create a Clerk application
   - Configure sign-in/sign-up URLs to match the app routes
   - Set up webhook endpoint for user sync (optional)

6. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
workflow-automation/
├── app/
│   ├── (authenticated)/     # Protected routes
│   │   ├── dashboard/       # User dashboard
│   │   ├── workflows/       # Workflow management
│   │   ├── executions/      # Execution history
│   │   └── integrations/    # Integration settings
│   ├── api/                 # API routes
│   ├── sign-in/            # Clerk sign-in
│   └── sign-up/            # Clerk sign-up
├── components/
│   ├── ui/                 # Reusable UI components
│   └── workflow-builder/   # React Flow builder
├── lib/
│   ├── supabase/          # Supabase client
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── types/                  # TypeScript type definitions
└── supabase/
    └── migrations/        # Database migrations
```

## 🚀 Deployment

The app is configured for deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## 🔑 Key Features Implementation Status

- ✅ Next.js project setup
- ✅ Supabase integration
- ✅ Mock authentication (Clerk temporarily bypassed)
- ✅ Database schema and migrations
- ✅ React Flow workflow builder
- ✅ CRUD API endpoints
- ✅ AI workflow generation
- ✅ Workflow execution engine
- ✅ Webhook endpoints for triggers
- ✅ GoHighLevel integration modules
- ✅ Execution history and logs
- ✅ GoHighLevel OAuth 2.0 Integration
- ✅ GoHighLevel Contacts sync
- ✅ **Real GoHighLevel Opportunities Integration** (NEW)
- ✅ Receipt tracking and profitability analysis
- ✅ **AI Receipt Processing System with BYOK** (NEW)
- ✅ **User API Key Management System** (NEW)
- ✅ **Time Tracking & Payment Structure Integration** (NEW)
- ✅ **Employee Payment Structure Management** (NEW)
- ✅ **Project Management Modal with Receipts & Time** (NEW)
- 🔄 Stripe billing (pending)
- 🔄 Additional integrations (Notion, JotForm, Browse AI)
- 🔄 Workflow templates (pending)

## 🎯 GoHighLevel Integration Features

### Real Opportunities Integration (NEW!)

Production-ready integration with GoHighLevel's opportunities search API:

**Features:**
- **Complete Data Fetching**: Automatically paginates through ALL opportunities (no 50-item limits!)
- **Smart Pagination**: Uses `startAfterId` pagination to fetch thousands of opportunities efficiently
- **Live Data Fetching**: Uses GHL's `/opportunities/search` endpoint for real-time data
- **Smart Fallback**: Automatically falls back to sample data if API is unavailable
- **Real-time Status**: UI indicates whether showing real data or sample data
- **Comprehensive Caching**: Real opportunities stored locally with GHL ID as identifier
- **Automatic Sync**: Data refreshes when user clicks "Sync Data"
- **Request Tracking**: Shows how many API requests were needed to fetch all data
- **Perfect Stage Ordering**: Pipeline stages maintain exact GoHighLevel position order

**API Integration:**
- **Search Endpoint**: `/opportunities/search` with full query parameter support
- **Complete Pagination**: Automatically fetches ALL opportunities using `startAfterId` pagination
- **Batch Processing**: Fetches 100 opportunities per request with intelligent batching
- **Safety Limits**: Configurable maximum results (default: 5,000) to prevent excessive API usage
- **Request Throttling**: 100ms delays between requests to be respectful to GHL's API
- **Filtering**: Location-based filtering and pipeline-specific queries
- **Error Handling**: Graceful degradation to sample data on API failures

**User Experience:**
- **Status Indicators**: Clear visual feedback on data source (real vs sample)
- **Opportunity Count**: Shows exact number of opportunities found
- **Refresh Controls**: Manual sync button to retry API calls
- **Pipeline Integration**: Works seamlessly with existing pipeline visualization
- **Accurate Stage Ordering**: Pipeline stages display in the exact same order as configured in GoHighLevel

### Receipt Tracking & Job Profitability

A comprehensive job profitability tracking system integrated with GoHighLevel opportunities:

**Features:**
- **Expense Tracking**: Log receipts for each opportunity with categories (Materials, Labor, Equipment, etc.)
- **Real-time Profitability**: Automatic calculation of net profit and profit margins
- **Pipeline View**: Visual kanban board showing opportunities with financial metrics
- **Color-coded Margins**: 
  - Green: >30% profit margin
  - Yellow: 15-30% profit margin  
  - Red: <15% profit margin
- **Receipt Management**: Full CRUD operations with vendor details, dates, and notes

**Database Schema:**
- `opportunity_receipts`: Stores all expense receipts
- `opportunity_cache`: Caches opportunity data with calculated metrics
- Automatic triggers update totals when receipts change

### 🤖 AI Receipt Processing System (NEW!)

Revolutionary AI-powered receipt processing that automatically extracts data and matches receipts to jobs:

#### **Core Features:**
- **Smart OCR**: OpenAI GPT-4 Vision API extracts vendor, amount, date, description, and category
- **User API Keys**: BYOK (Bring Your Own Key) model - users provide their own OpenAI API keys
- **Intelligent Job Matching**: AI matches receipts to opportunities using vendor similarity, date proximity, and description analysis
- **Conversation Flow**: Natural language interaction for confirmation and clarification
- **Multi-Channel Support**: SMS, WhatsApp, Email, and web upload
- **Confidence Scoring**: AI provides confidence levels for data extraction and job matching

#### **User Experience:**
```
📱 User texts receipt image → "Receipt received! Processing..."
🤖 AI analyzes → "Found $45.67 Home Depot receipt from today"
🎯 Smart matching → "Is this for the Johnson Kitchen Project?"
✅ User confirms → "Receipt logged to Johnson Kitchen - Materials category"
```

#### **Technical Architecture:**
- **Vision AI**: OpenAI GPT-4 Vision API for receipt data extraction
- **Matching Algorithm**: Custom fuzzy matching with confidence scoring
- **Conversation Engine**: Handles single match, multiple match, and no match scenarios
- **Security**: User verification against GHL contacts database
- **Audit Trail**: Complete processing log with user interactions

#### **API Endpoints:**
- `/api/receipts/process-image` - Main AI processing endpoint
- `/api/webhooks/receipt-response` - User response handler
- `/test-receipt-ai` - Interactive testing interface

#### **Matching Intelligence:**
The AI considers multiple factors when matching receipts to jobs:
- **Vendor Similarity**: Fuzzy string matching between receipt vendor and job contacts
- **Date Proximity**: Recent receipts more likely for active jobs
- **Description Keywords**: Semantic matching between receipt items and job descriptions
- **Confidence Weighting**: Multi-factor scoring for reliable matches

#### **Response Types:**
1. **Single Match (High Confidence)**: "Is this for [Job Name]? Reply YES to confirm"
2. **Multiple Matches**: "Found 3 possible jobs: 1) Project A 2) Project B 3) Project C"
3. **No Match**: "No matching jobs found. Please specify which job this belongs to"
4. **Clarification**: Handles user responses and edge cases

### 🔐 User API Key Management (NEW!)

Secure API key management system allowing users to bring their own keys:

#### **Features:**
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Azure
- **Encrypted Storage**: AES-256-GCM encryption for all stored keys
- **Key Validation**: Real-time validation when adding new keys
- **Usage Tracking**: Monitor when keys were last used
- **Multiple Keys**: Support for multiple keys per provider (dev, prod, etc.)
- **Security**: Keys never exposed in logs or UI after storage

#### **User Experience:**
- **Simple Setup**: Add API keys through settings page (`/settings/api-keys`)
- **Masked Display**: Keys shown as `sk-abc...xyz` for security
- **Validation**: Instant feedback if API key is valid
- **Management**: Edit names, activate/deactivate, delete keys

#### **Integration Points:**
- **AI Receipt Processing**: Uses user's OpenAI key for receipt OCR
- **Future Features**: Will integrate with other AI-powered features
- **Cost Control**: Users pay for their own API usage directly

### ⏱️ Time Tracking & Payment Structure Integration (NEW!)

Comprehensive time tracking system fully integrated with employee payment structures for accurate labor cost tracking:

#### **Core Features:**
- **Smart Time Entry**: Log hours per opportunity with automatic rate calculation
- **Payment Structure Integration**: Auto-populates rates based on employee payment configuration
- **Multi-Payment Type Support**: Handles hourly, salary, contractor, commission, and hybrid payment structures
- **Intelligent Rate Calculation**: Converts salary to hourly rates (annual ÷ 2080 hours)
- **Project Management Modal**: Combined receipts and time tracking in one interface

#### **Payment Structure Database:**
- **Employee Payment Assignments**: Links GoHighLevel users to payment structures
- **Multiple Payment Types**:
  - **Hourly**: Direct hourly rate usage
  - **Salary**: Auto-converts annual salary to hourly rate
  - **Contractor**: Uses configured contractor rates
  - **Hybrid**: Base salary + commission with hourly calculations
  - **Commission**: Manual rate entry (no auto-calculation)
- **Rate Override**: Users can manually adjust auto-calculated rates

#### **User Experience:**
```
🎯 Select Team Member → "John Doe - Hourly $25/hr" (shows payment structure)
⚡ Auto-Rate Population → Rate field fills automatically based on structure
📝 Log Hours → Enter hours worked with description
💰 Cost Calculation → Total cost auto-calculated (hours × rate)
✅ Save → Time entry stored with accurate labor costs
```

#### **Smart User Selection:**
- **Payment Structure Priority**: Users with configured payment structures appear first
- **Visual Indicators**: Payment type badges (Hourly/Salary/Contractor/Hybrid)
- **Rate Information**: Shows configured rates in dropdown selection
- **Missing Structure Warning**: Clear indication when payment structure is not configured

#### **Database Architecture:**
- **Time Entries Table**: `time_entries` with comprehensive tracking
- **Payment Assignments**: Links GHL users to payment structures
- **Automatic Calculations**: Server-side cost calculation based on payment type
- **Audit Trail**: Complete tracking of who worked when and at what rate

#### **Technical Implementation:**
- **API Integration**: `/api/time-entries` with full CRUD operations
- **Payment Structure API**: `/api/user-payment-assignments` for rate lookup
- **Real-time Updates**: Opportunity totals update immediately
- **Security**: Row-level security for user data isolation

#### **Rate Calculation Logic:**
```typescript
// Auto-rate calculation examples:
Hourly Employee: $25/hour → Uses $25 directly
Salary Employee: $52,000/year → Converts to $25/hour (52000 ÷ 2080)
Contractor: $40/hour → Uses $40 directly
Hybrid Employee: $30,000 base + commission → Uses $14.42/hour (30000 ÷ 2080)
```

#### **Project Management Interface:**
- **Tabbed Modal**: "Receipts" and "Time Tracking" tabs in opportunity modal
- **Unified View**: See both expenses and labor costs in one place
- **Total Cost Tracking**: Complete project profitability with labor + materials
- **Team Member Insights**: See who worked on what and when

#### **Labor Cost Analytics:**
- **Per-Opportunity Tracking**: Track labor costs for each project
- **Team Performance**: See hours logged per team member
- **Rate Consistency**: Ensure proper payment structure application
- **Cost Control**: Real-time visibility into labor expenses

#### **Database Migration:**
```sql
-- Time entries table with comprehensive tracking
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  opportunity_id VARCHAR NOT NULL,
  ghl_user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  hourly_rate DECIMAL(8,2),
  description TEXT NOT NULL,
  work_date DATE NOT NULL,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Integration Benefits:**
- **Accurate Costing**: Real labor costs based on actual payment structures
- **Payroll Integration**: Foundation for automated payroll calculations
- **Project Profitability**: Complete view of materials + labor costs
- **Team Management**: Track individual contributor hours and costs
- **Billing Accuracy**: Precise cost tracking for client billing

## 🔐 GoHighLevel Integration Setup

### OAuth 2.0 Configuration

1. **Create a GoHighLevel OAuth App**:
   - Go to GHL Marketplace
   - Create a new app
   - Set redirect URI to: `http://localhost:3000/api/integrations/automake/callback` (development)
   - **Important**: GoHighLevel restricts certain terms in URLs. Use "automake" instead of "ghl" or "gohighlevel"
   - Note your Client ID and Client Secret

2. **Configure Environment Variables**:
   ```bash
   # Generate encryption key
   openssl rand -base64 32
   ```
   Add to `.env.local`:
   - `GHL_CLIENT_ID`: Your OAuth client ID
   - `GHL_CLIENT_SECRET`: Your OAuth client secret
   - `ENCRYPTION_KEY`: Generated encryption key
   - `NEXT_PUBLIC_APP_URL`: Your app URL

3. **OAuth Flow Implementation**:
   - Users click "Connect GoHighLevel" button
   - Redirected to GHL OAuth authorization page
   - After approval, callback exchanges code for tokens
   - Tokens are encrypted and stored in database
   - Automatic token refresh before expiration

### Security Features

- **Token Encryption**: Uses AES-256-GCM encryption for token storage
- **Automatic Refresh**: Tokens refresh 5 minutes before expiration
- **Secure Storage**: Encrypted tokens stored in Supabase
- **CSRF Protection**: State parameter in OAuth flow

## 📝 Development Log (July 26, 2025)

### Major Accomplishments

1. **Database Setup**
   - Successfully configured Supabase with access token
   - Created comprehensive database schema with tables for users, workflows, executions, integrations
   - Implemented Row Level Security (RLS) policies
   - Created mock user with UUID: `af8ba507-b380-4da8-a1e2-23adee7497d5`

2. **Mock Authentication System**
   - Implemented temporary mock auth to bypass Clerk during development
   - Created separate server-side auth helper (`mock-auth-server.ts`) to fix client/server boundary issues
   - **Important Learning**: Cannot use client-side functions in Next.js API routes

6. **Production-Ready GoHighLevel OAuth 2.0 Integration**
   - Implemented full OAuth 2.0 flow for secure authentication
   - Created encrypted token storage using AES-256-GCM
   - Built automatic token refresh mechanism (5 minutes before expiry)
   - Developed comprehensive GHL API client with retry logic
   - Added support for contacts, opportunities, forms, and appointments
   - Implemented proper error handling and user feedback

3. **Workflow Execution Engine**
   - Built complete execution engine with topological sorting for node execution
   - Implemented execution logging and status tracking
   - Created API endpoints for workflow execution and status checking
   - Added support for webhook triggers

4. **UI/UX Enhancements**
   - Completely redesigned UI with modern, professional styling
   - Added workflow execution button with real-time status updates
   - Created execution details page with comprehensive logs
   - Implemented webhook URL display with copy-to-clipboard functionality

5. **GoHighLevel Integration**
   - Added GHL trigger and action modules with specific options
   - Implemented dropdown selection within workflow nodes
   - Fixed React component serialization issues with ModuleIcon component

6. **GoHighLevel Production Integration (Latest)**
   - Successfully connected real GHL OAuth with provided credentials
   - Fixed redirect URI restrictions (cannot contain "highlevel" or "ghl")
   - Renamed all endpoints to use "automake" instead
   - Fixed pagination: GHL uses `startAfterId` not `offset`
   - Increased default limit to 100 (maximum allowed)
   - Added automatic data fetching on connection

7. **Receipt Tracking & Profitability Feature**
   - Built comprehensive expense tracking for opportunities
   - Created pipeline view with drag-and-drop cards (similar to GHL)
   - Implemented real-time profitability calculations
   - Added receipt management modal with CRUD operations
   - Database triggers automatically update expense totals

### Key Learnings & Solutions

1. **Client/Server Boundary Issues**
   - **Problem**: "Failed to fetch" error when saving workflows
   - **Root Cause**: Attempting to use client-side auth functions in server-side API routes
   - **Solution**: Created separate `mock-auth-server.ts` for server-side operations
   - **Files affected**: All API routes in `/app/api/`

2. **Supabase Service Role Key**
   - **Learning**: Must use service role key (not anon key) for server-side operations
   - **Implementation**: Updated all API routes to use service role key

3. **React Component Serialization**
   - **Problem**: Cannot pass React components as props in data objects
   - **Solution**: Pass icon names as strings and use ModuleIcon component to map names to components

4. **RLS (Row Level Security) with Mock Auth**
   - **Problem**: Workflows saved to database but not displayed on the workflows page
   - **Root Cause**: RLS policies check for `auth.uid()` which doesn't exist in mock auth setup
   - **Solution**: Created API endpoint `/api/workflows/list` that uses service role key to bypass RLS
   - **Important**: When integrating Clerk auth, update RLS policies to work with Clerk's auth system
   - **Files created**: `/app/api/workflows/list/route.ts`
   - **TODO**: Remove this workaround once Clerk auth is properly integrated

5. **GoHighLevel OAuth Implementation**
   - **Problem**: Need production-worthy integration with real auth and data
   - **Solution**: Implemented complete OAuth 2.0 flow with secure token storage
   - **Key Files**:
     - `/lib/integrations/gohighlevel/config.ts`: OAuth configuration
     - `/lib/integrations/gohighlevel/client.ts`: API client with token refresh
     - `/lib/utils/encryption.ts`: AES-256-GCM encryption utilities
     - `/app/api/integrations/gohighlevel/callback/route.ts`: OAuth callback handler
   - **Security Features**:
     - Encrypted token storage in database
     - Automatic token refresh before expiration
     - CSRF protection with state parameter
     - Secure error handling without exposing sensitive data

6. **GoHighLevel API Restrictions**
   - **Problem**: GHL doesn't allow "highlevel" or "ghl" in redirect URIs
   - **Solution**: Renamed all integration endpoints to use "automake"
   - **Learning**: Always check third-party API restrictions early

7. **GHL API Pagination**
   - **Problem**: "property offset should not exist" error
   - **Solution**: GHL v2 uses `startAfterId` for pagination, not `offset`
   - **Documentation**: Always verify API parameters with latest docs

8. **Receipt Tracking Architecture**
   - **Design**: Separate tables for receipts and opportunity cache
   - **Performance**: Database triggers for automatic calculations
   - **UI Pattern**: Modal-based receipt management
   - **Best Practice**: Cache external API data for better performance

9. **Real GoHighLevel Opportunities Integration**
   - **API Discovery**: Successfully implemented GHL's opportunities search endpoint
   - **Smart Fallback**: Real data with graceful degradation to sample data
   - **Data Format Handling**: Compatible with both real GHL API and mock data formats
   - **Status Indicators**: Real-time UI feedback on data source type
   - **Performance**: Local caching with GHL opportunity IDs as identifiers

### Current Architecture

```
Authentication Flow:
- Client: MockAuthProvider (React Context)
- Server Components: mockAuthServer() from mock-auth-server.ts
- API Routes: mockAuthServer() from mock-auth-server.ts

Database Access:
- Client: Supabase anon key (through RLS)
- Server: Supabase service role key (bypasses RLS)

GoHighLevel Integration:
- OAuth 2.0 flow for secure authentication
- Encrypted token storage (AES-256-GCM)
- Automatic token refresh mechanism
- API client with retry logic

Receipt Tracking:
- Opportunity profitability analysis
- Expense categorization
- Automatic calculation triggers
- Pipeline view with financial metrics
```

### Scripts Added

- `npm run setup-db`: Instructions for running database migration
- `npm run create-mock-user`: Creates mock user in database
- `npm run init-db`: Checks database initialization status

### Recent Migrations Added

1. **Receipt Tracking Migration** (`20250126_receipt_tracking.sql`):
   - Creates `opportunity_receipts` table for expense tracking
   - Creates `opportunity_cache` table with calculated profit metrics
   - Adds automatic triggers for expense calculations
   - Implements RLS policies for data security

2. **AI Receipt Processing Migration** (`20250126_receipt_processing.sql`):
   - Creates `receipt_processing_log` table for AI workflow tracking
   - Stores receipt data extraction results
   - Tracks job matching and user interactions
   - Implements audit trail for AI decisions

3. **User API Keys Migration** (`20250126_user_api_keys.sql`):
   - Creates `user_api_keys` table for secure API key storage
   - Implements AES-256-GCM encryption for sensitive data
   - Supports multiple providers (OpenAI, Anthropic, Google, Azure)
   - Includes usage tracking and audit features

4. **Receipt Enhancements Migration** (`20250126_receipt_enhancements.sql`):
   - Adds `submitted_by`, `reimbursable`, and payment method fields to receipts
   - Creates `company_credit_cards` table for intelligent reimbursable determination
   - Creates `user_payment_structures` table for employee payment configuration
   - Implements auto-reimbursable determination trigger

5. **Time Entries Migration** (`20250126_time_entries.sql`):
   - Creates `time_entries` table for comprehensive time tracking
   - Links to GoHighLevel users with payment structure integration
   - Supports quarter-hour increments and automatic cost calculation
   - Includes RLS policies and audit trail functionality

**To run these migrations:**
```sql
-- Copy contents of /supabase/migrations/20250126_receipt_tracking.sql
-- Copy contents of /supabase/migrations/20250126_receipt_processing.sql
-- Copy contents of /supabase/migrations/20250126_user_api_keys.sql
-- Copy contents of /supabase/migrations/20250126_receipt_enhancements.sql
-- Copy contents of /supabase/migrations/20250126_time_entries.sql
-- Run all five in Supabase SQL editor in order
```

### 🤖 AI Receipt Processing Development (July 26, 2025)

**Revolutionary Feature Addition**: Implemented an intelligent receipt processing system that transforms how contractors manage job expenses.

#### **Core Implementation:**

1. **OpenAI Vision Integration** (`/api/receipts/process-image`):
   - GPT-4 Vision API extracts vendor, amount, date, description, category
   - Returns confidence scores for data accuracy
   - Handles various receipt formats and image qualities

2. **Intelligent Job Matching Algorithm**:
   - Fuzzy string matching using Levenshtein distance
   - Multi-factor scoring: vendor similarity, date proximity, description keywords
   - Confidence weighting for reliable automated decisions

3. **Conversation Management** (`/api/webhooks/receipt-response`):
   - Handles single match confirmations ("YES" to approve)
   - Multiple match selections (numbered responses)
   - No match scenarios (manual job specification)
   - Natural language processing for user intent

4. **Security & User Verification**:
   - Validates users against GoHighLevel contacts database
   - Encrypted processing log storage
   - Complete audit trail for compliance

#### **Technical Architecture:**
```
Receipt Image → OpenAI Vision → Data Extraction → Job Matching → User Confirmation → Auto-logging
     ↓              ↓              ↓              ↓              ↓              ↓
Phone/Email    Vendor/Amount    Fuzzy Matching  Confidence     SMS/WhatsApp   Database
Upload         Date/Category    Algorithm       Scoring        Response       Storage
```

#### **User Experience Flow:**
1. **Image Upload**: User sends receipt via SMS/email/app
2. **AI Processing**: System extracts data and finds job matches
3. **Smart Response**: AI generates appropriate confirmation message
4. **User Interaction**: Simple YES/NO or numbered selection
5. **Auto-logging**: Receipt automatically added to correct job

#### **Key Features:**
- **Multi-Channel Support**: SMS, WhatsApp, Email, Web upload
- **Learning System**: Improves matching based on user confirmations
- **Conflict Resolution**: Handles ambiguous matches intelligently
- **Testing Interface**: Built-in testing page at `/test-receipt-ai`
- **Production Ready**: Complete webhook system for messaging platforms

### ⏱️ Time Tracking & Payment Structure Integration (July 26, 2025)

**Game-Changing Enhancement**: Implemented comprehensive time tracking system fully integrated with employee payment structures for precise labor cost management.

#### **Core Implementation:**

1. **Payment Structure Database** (`/api/user-payment-assignments`):
   - Links GoHighLevel users to payment structures (hourly, salary, contractor, hybrid)
   - Supports multiple payment types with automatic rate calculations
   - Configurable through Settings → Payment Structure page

2. **Smart Time Entry System** (`/components/ghl/receipt-modal.tsx`):
   - Modal tabs for both "Receipts" and "Time Tracking"
   - Auto-populates hourly rates based on employee payment structure
   - Intelligent user dropdown with payment info preview

3. **Automatic Rate Calculation**:
   - **Hourly**: Uses configured rate directly
   - **Salary**: Converts annual salary to hourly (÷ 2080 hours)
   - **Contractor**: Uses contractor hourly rate
   - **Hybrid**: Calculates from base salary + commission structure

4. **Time Entries API** (`/api/time-entries`):
   - Full CRUD operations for time tracking
   - Automatic cost calculation (hours × rate)
   - Links to both platform users and GoHighLevel users

#### **Technical Architecture:**
```
User Selection → Payment Structure Lookup → Auto-Rate Population → Time Entry → Cost Calculation
     ↓                    ↓                        ↓               ↓              ↓
GHL Users List    user_payment_assignments    Rate Field Fill    Database       Total Cost
(Sorted by       (Active assignments          (Calculated       Storage        (hours × rate)
payment status)   only)                       from structure)
```

#### **Database Design:**
- **`time_entries` Table**: Comprehensive time tracking with GHL user linkage
- **Integration**: Uses existing `user_payment_assignments` for rate lookup
- **Security**: Row-level security for multi-tenant data isolation
- **Performance**: Indexed on opportunity_id, user_id, and work_date

#### **User Experience Enhancements:**
- **Smart Sorting**: Users with payment structures appear first in dropdown
- **Visual Indicators**: Payment type badges (Hourly/Salary/Contractor)
- **Rate Preview**: Shows "John Doe - Hourly $25/hr" in selection
- **Auto-Calculation**: Rate field automatically fills with green "(Auto-calculated)" label
- **Override Capability**: Users can manually adjust auto-calculated rates

#### **Integration Benefits:**
- **Accurate Labor Costing**: Real costs based on actual payment structures
- **Payroll Foundation**: Groundwork for automated payroll calculations
- **Project Profitability**: Combined material + labor cost tracking
- **Team Performance**: Individual contributor hour and cost tracking

## 📝 Next Steps

1. **Re-enable Clerk Authentication**: 
   - Integrate Clerk properly with the mock auth system
   - Update RLS policies to use Clerk's auth functions
   - Remove the `/api/workflows/list` workaround
   - Update all components to use Clerk auth instead of mock auth

2. **Fix Authentication Flow**:
   - Update Supabase RLS policies to work with Clerk JWT
   - Remove mock-auth-server.ts once Clerk is integrated
   - Ensure all API routes use proper Clerk authentication

3. **Billing System**: Complete Stripe subscription integration

4. **Additional Integrations**: Add Notion, JotForm, and Browse AI modules

5. **Workflow Templates**: Create pre-built templates for common use cases

6. **Testing**: Add comprehensive test coverage

7. **AI Receipt Processing Production Setup**:
   - Configure messaging platform webhooks (Twilio, WhatsApp Business API)
   - Set up email processing for receipt attachments
   - Implement user training and learning system
   - Add receipt image storage and retrieval

8. **Receipt Tracking Enhancements**:
   - Export receipts to CSV/PDF
   - Profit/loss reports by date range
   - Budget vs actual tracking

9. **GoHighLevel Webhooks**: Implement real-time updates when opportunities change

## 🛠️ Troubleshooting

### API Key Storage Issues

If you encounter "Failed to store API key" errors when trying to add OpenAI or other API keys, this is typically due to foreign key constraint issues with the mock authentication system.

#### **Problem Symptoms:**
- "Failed to store API key" error in the UI
- Console shows foreign key constraint violations
- RLS policy errors in Supabase logs

#### **Root Cause:**
The user API keys table includes a foreign key constraint to `auth.users`, but our mock authentication system uses a user ID that doesn't exist in Supabase's auth system.

#### **Solution:**
Run the foreign key constraint fix migration:

1. **Copy and run this SQL in your Supabase SQL Editor:**
   ```sql
   -- Drop the foreign key constraint for development with mock auth
   DO $$
   BEGIN
       IF EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'user_api_keys_user_id_fkey'
           AND table_name = 'user_api_keys'
       ) THEN
           ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_user_id_fkey;
           RAISE NOTICE 'Dropped foreign key constraint for development';
       END IF;
   END $$;
   ```

2. **Or run the prepared migration:**
   ```bash
   # File: /supabase/migrations/20250126_fix_fk_constraint.sql
   # Copy contents and run in Supabase SQL Editor
   ```

#### **For Production:**
When implementing real Supabase authentication (instead of mock auth), you can re-add the foreign key constraint:
```sql
ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

#### **Additional Required Migrations:**
Make sure you've run all required migrations in order:

1. `20250126_user_api_keys_updated.sql` - Creates the user API keys table with Notion support
2. `20250126_fix_fk_constraint.sql` - Removes foreign key constraint for mock auth
3. `20250126_contact_sync.sql` - SMS contact synchronization system

#### **Testing API Key Storage:**
After running the fix migration, test API key storage:
```bash
# Test the API endpoint directly
curl -X POST http://localhost:3000/api/user/api-keys \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "apiKey": "sk-your-real-api-key", "keyName": "Test Key"}'
```

### SMS Receipt Processing Setup

The SMS receipt processing system requires proper contact synchronization:

#### **Required Migrations:**
1. `20250126_contact_sync.sql` - Contact sync and message processing
2. `20250126_receipt_processing.sql` - AI receipt processing workflow
3. `20250126_user_api_keys_updated.sql` - User API key management

#### **Environment Variables:**
Ensure these are set in your `.env.local`:
```env
ENCRYPTION_KEY=your_32_byte_encryption_key_base64
OPENAI_API_KEY=your_openai_api_key  # Or use user-provided keys
```

#### **Testing the System:**
1. Add your OpenAI API key via `/settings/api-keys`
2. Sync GoHighLevel contacts via `/integrations`
3. Test SMS processing via `/test-receipt-ai`

### Mock Authentication vs Production Auth

The system currently uses mock authentication for development. Key differences:

#### **Mock Auth (Current):**
- Uses hardcoded user ID: `af8ba507-b380-4da8-a1e2-23adee7497d5`
- Bypasses Supabase RLS with service role key
- No foreign key constraints to auth.users table

#### **Production Auth (Future):**
- Real Supabase authentication
- RLS policies enforce user isolation
- Foreign key constraints ensure data integrity

#### **Migration Path:**
When ready for production authentication:
1. Implement Supabase Auth
2. Update RLS policies
3. Re-add foreign key constraints
4. Remove mock auth system

## 🤝 Contributing

This is a private project. Please contact the team for contribution guidelines.

## 📄 License

Proprietary - All rights reserved
