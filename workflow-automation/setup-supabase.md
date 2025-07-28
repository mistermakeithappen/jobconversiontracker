# Supabase Setup Instructions

## 1. Environment Configuration

Copy the `env-template.txt` file to `.env.local` and fill in your actual Supabase credentials:

```bash
cp env-template.txt .env.local
```

Get your Supabase credentials from:
- **Project URL**: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/settings/api
- **API Keys**: Same page as above

## 2. Database Migration

You need to run the initial database schema migration. You have two options:

### Option A: Using Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new
2. Copy the contents of `supabase/migrations/20250125_initial_schema.sql`
3. Paste and run in the SQL editor

### Option B: Using Supabase CLI (requires Docker)
```bash
# If you have Docker running
supabase db push
```

## 3. Initialize Mock Data

After setting up your `.env.local` file with the correct credentials, run:

```bash
npm run setup:db
```

Or manually run:
```bash
npx tsx scripts/init-database.ts
```

## 4. Start Development Server

```bash
npm run dev
```

## Current Project Reference
- Project ID: `hmulhwnftlsezkjuflxm`
- Dashboard: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm

## Database Schema Overview

The migration creates these main tables:
- `users` - User profiles synced from Clerk
- `workflows` - User workflow definitions
- `workflow_versions` - Version history for workflows
- `executions` - Workflow execution logs
- `api_keys` - Encrypted API keys for integrations
- `integrations` - Integration connections
- `workflow_templates` - Predefined workflow templates

## Row Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data. 