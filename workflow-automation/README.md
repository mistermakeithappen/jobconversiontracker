# AI-Powered Workflow Automation Platform

A Make.com competitor that democratizes workflow automation through AI. Users describe their automation needs in plain English, and our AI generates complete, functional workflows instantly.

## 🚀 Features

- **AI Workflow Generation**: Natural language to workflow creation
- **Visual Workflow Builder**: Drag-and-drop interface with React Flow
- **GoHighLevel CRM Integration**: Full OAuth 2.0 integration with contact, opportunity, and commission tracking
- **AI Receipt Processing**: SMS and web upload receipt capture with automatic job matching
- **Reimbursement Management**: Track pending, reimbursed, and company card expenses
- **Product Commission System**: MRR tracking, product-based rules, and performance analytics
- **Sales Gamification**: Leaderboards, challenges, and achievement tracking
- **MCP-Powered Chatbot**: AI assistant with full GoHighLevel control
- **Custom Bot Builder**: Visual designer for creating business-specific chatbots
- **Multi-tenant Architecture**: Organization-based data isolation with RBAC
- **BYOK Model**: Users bring their own API keys (OpenAI)

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS 4, React Flow
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL) with RLS
- **AI**: OpenAI GPT-4 Vision (BYOK model)
- **Integrations**: GoHighLevel OAuth 2.0, MCP Protocol
- **Deployment**: Vercel-optimized

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- GoHighLevel developer app (for OAuth)

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
   
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   # GoHighLevel OAuth
   GHL_CLIENT_ID=your_ghl_client_id
   GHL_CLIENT_SECRET=your_ghl_client_secret
   
   # Encryption key for secure token storage (generate with: openssl rand -base64 32)
   ENCRYPTION_KEY=your_32_byte_encryption_key_base64
   
   # App URL (update for production)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Supabase**
   
   - Create a new Supabase project
   - **IMPORTANT**: Run the migrations in order from `supabase/migrations/`
   - See `MIGRATION_ORDER.md` for the correct sequence
   - Enable Row Level Security (RLS) as defined in the migrations

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
workflow-automation/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (authenticated)/     # Protected routes
│   │   ├── ghl/            # GoHighLevel features (main dashboard)
│   │   │   ├── contacts/    # Contact management
│   │   │   ├── opportunities/ # Opportunity pipeline
│   │   │   ├── receipts/    # Receipt & reimbursement tracking
│   │   │   ├── sales/       # Sales, products & commissions
│   │   │   │   ├── products/    # Product catalog
│   │   │   │   ├── analytics/   # Performance analytics
│   │   │   │   ├── leaderboard/ # Gamification
│   │   │   │   └── commissions/ # Commission rules
│   │   │   └── settings/    # GHL integration settings
│   │   ├── workflows/       # Workflow management
│   │   ├── chatbot/         # AI chatbot interface
│   │   └── settings/        # User settings
│   ├── api/                 # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── integrations/   # Integration APIs
│   │   ├── receipts/       # Receipt processing
│   │   ├── webhooks/       # Webhook handlers
│   │   ├── products/       # Product sync
│   │   ├── commissions/    # Commission management
│   │   └── mcp/            # MCP integration
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── workflow-builder/   # React Flow builder
│   └── ghl/               # GoHighLevel components
├── lib/
│   ├── auth/              # Authentication helpers
│   ├── supabase/          # Supabase client
│   ├── integrations/      # Integration clients
│   ├── mcp/               # MCP client
│   └── utils/             # Utility functions
└── supabase/
    └── migrations/        # Database migrations (001-015)
```

## 🎯 Key Features

### GoHighLevel Integration
- **OAuth 2.0**: Secure authentication with automatic token refresh
- **Contact Sync**: Full contact database synchronization
- **Opportunity Tracking**: Pipeline management with profitability analysis
- **Commission Tracking**: Automated commission calculation and assignment
- **Product Sync**: Import and track products with commission rules
- **MCP Integration**: 21 official GoHighLevel tools via Model Context Protocol

### AI Receipt Processing
- **SMS Capture**: Team members text receipts to GHL number
- **Smart Extraction**: AI extracts vendor, amount, date, payment method
- **Job Matching**: Automatically matches receipts to assigned opportunities
- **Conversational Flow**: Confirms job assignment via SMS conversation
- **Reimbursement Tracking**: Automatic detection of company vs personal expenses
- **Three-Tab View**: Pending, Reimbursed, and Company Card expenses

### Commission & Sales System
- **Product-Based Rules**: Different rates for initial sale vs renewals
- **MRR Tracking**: Monthly recurring revenue with duration/lifetime options
- **Performance Analytics**: Sales velocity, conversion rates, revenue trends
- **Gamification**: Leaderboards, challenges, achievement badges
- **Smart Validation**: Ensures commissions don't exceed margins
- **Payout Management**: Track and export commission payouts

### AI-Powered Chatbot
- **Personal Assistant**: Platform-wide assistant using MCP for GHL operations
- **Custom Bot Builder**: Visual designer for business-specific bots
- **21 MCP Tools**: Full access to contacts, calendars, opportunities, etc.
- **Intelligent Responses**: GPT-4 powered with function calling
- **Multi-Channel**: Deploy to SMS, web chat, social media

## 🗄️ Database Architecture

The database uses a **multi-tenant architecture** with organization-based data isolation:

### Core Tables
- **organizations**: Central tenant table
- **users**: Platform users linked to Clerk auth
- **organization_members**: User-organization relationships with roles
- **team_members**: External team members (e.g., sales reps)

### Key Features
- **Role-Based Access Control**: 5 roles (owner, admin, manager, member, viewer)
- **Row-Level Security**: Automatic data isolation by organization
- **Foreign Key Relationships**: Ensures data integrity
- **Audit Trails**: Created/updated timestamps on all tables

### Integration Tables
- **integrations**: OAuth connections and configurations
- **opportunity_receipts**: Receipt tracking with reimbursement status
- **opportunity_cache**: Cached opportunity data with calculations
- **commission_product_rules**: Product-specific commission rules
- **user_api_keys**: Encrypted storage for user API keys

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build           # Production build
npm run lint            # ESLint check
npm run typecheck       # TypeScript check

# Database
npm run setup-db        # Run all migrations in order
npm run init-db         # Check database status

# Testing
npm run dev:tunnel      # Dev server with ngrok tunnel (for webhooks)
```

## 🚀 Testing Key Features

### Receipt Processing via SMS
1. Ensure team member exists in database with phone number
2. Configure OpenAI API key in organization settings
3. Text a receipt image to your GHL number
4. Respond to the SMS to confirm job assignment
5. Check `/ghl/receipts` for the processed receipt

### Commission Tracking
1. Create commission rules in `/ghl/sales/commissions/products`
2. Sync opportunities from GoHighLevel
3. Mark opportunities as won/paid
4. View calculated commissions in the opportunities table

### Product Analytics
1. Sync products from GoHighLevel
2. View performance metrics at `/ghl/sales/analytics`
3. Track sales velocity and conversion rates
4. Monitor MRR and product performance

## 🔐 Security Features

- **Token Encryption**: AES-256-GCM for OAuth tokens
- **API Key Encryption**: Secure storage for user API keys
- **Row-Level Security**: PostgreSQL RLS for data isolation
- **RBAC**: Fine-grained permission control
- **Audit Trails**: Complete activity logging
- **Clerk Authentication**: Production-ready auth with MFA support

## 🛠️ Troubleshooting

### Common Issues

1. **SMS Receipt Processing**
   - Verify sender is in team_members table with correct phone
   - Check organization has OpenAI API key configured
   - Ensure opportunities are assigned to the team member
   - Check webhook logs for incoming messages

2. **GoHighLevel Sync**
   - Verify OAuth connection is active
   - Check token refresh is working
   - Ensure proper API scopes are granted
   - Monitor rate limits

3. **Commission Calculations**
   - Verify commission rules are configured
   - Check opportunity has monetary value
   - Ensure pipeline stages are analyzed
   - Review commission_calculations table

## 📝 Recent Updates (August 2025)

### SMS Receipt Processing
- Complete conversational flow for receipt capture
- AI-powered job matching with team member filtering
- Automatic reimbursable status detection
- Integration with reimbursement tracking system

### Reimbursement Management
- Three-tab view: Pending, Reimbursed, Company Card
- Mark as paid functionality
- Company card detection via last 4 digits
- Export and reporting capabilities

### Product Commission System
- Recurring revenue tracking with MRR support
- Product performance analytics dashboards
- Sales gamification with leaderboards
- Smart commission validation

### UI/UX Improvements
- Default login redirect to /ghl dashboard
- Database-first loading for instant display
- Background sync for fresh data
- Improved text contrast and readability

## 🚀 Deployment

The app is configured for deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Configure GHL webhook URLs
5. Deploy

### Production Checklist
- [ ] Update NEXT_PUBLIC_APP_URL
- [ ] Configure production Supabase
- [ ] Set up Clerk production keys
- [ ] Update GHL OAuth redirect URLs
- [ ] Configure webhook endpoints
- [ ] Enable all security features

## 📄 License

Proprietary - All rights reserved