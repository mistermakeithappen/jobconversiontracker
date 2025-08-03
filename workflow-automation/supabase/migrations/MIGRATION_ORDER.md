# Database Migration Order

This document outlines the consolidated database migrations that replace all previous migrations. These migrations have been optimized to eliminate redundancy and establish a clean, efficient database structure.

## Migration Files (Run in this exact order)

### 1. `001_initial_setup.sql`
- **Purpose**: Core setup and helper functions
- **Creates**: 
  - Extensions (uuid-ossp, pgcrypto)
  - Helper functions (update_updated_at_column, generate_payout_number)
- **Dependencies**: None

### 2. `002_organizations_and_auth.sql`
- **Purpose**: Multi-tenancy foundation
- **Creates**:
  - organizations table (master accounts)
  - users table (Supabase Auth sync)
  - organization_members table (user-org relationships with roles)
  - team_members table (all team members, replacing ghl_user_id)
  - role_permissions table (RBAC definitions)
- **Dependencies**: 001_initial_setup.sql

### 3. `003_core_platform_tables.sql`
- **Purpose**: Core workflow automation platform
- **Creates**:
  - workflows table
  - workflow_versions table
  - executions table
  - integrations table
  - api_keys table (organization-level)
  - user_api_keys table (external services)
  - workflow_templates table
- **Dependencies**: 002_organizations_and_auth.sql

### 4. `004_gohighlevel_integration.sql`
- **Purpose**: GoHighLevel integration tables
- **Creates**:
  - contacts table
  - contact_sync_logs table
  - pipeline_stages table
  - opportunity_receipts table
  - receipt_processing_log table
  - time_entries table
  - company_credit_cards table
- **Dependencies**: 002_organizations_and_auth.sql, 003_core_platform_tables.sql

### 5. `005_sales_and_commissions.sql`
- **Purpose**: Comprehensive sales and commission system
- **Creates**:
  - ghl_products table
  - sales_transactions table
  - commission_structures table
  - commission_rules table
  - commission_calculations table
  - commission_payouts table
  - payout_line_items table
  - pipeline_stage_analysis table
- **Dependencies**: 002_organizations_and_auth.sql, 003_core_platform_tables.sql, 004_gohighlevel_integration.sql

### 6. `006_chatbot_system.sql`
- **Purpose**: Advanced chatbot and conversation system
- **Creates**:
  - bots table
  - chatbot_workflows table
  - bot_workflows table (junction)
  - workflow_nodes table
  - workflow_connections table
  - conversation_sessions table
  - conversation_messages table
  - workflow_goal_evaluations table
  - workflow_actions_log table
  - bot_knowledge_base table
  - appointment_bookings table
  - chat_sessions table
- **Dependencies**: 002_organizations_and_auth.sql

### 7. `007_mcp_integration.sql`
- **Purpose**: Model Context Protocol integration
- **Creates**:
  - mcp_integrations table
  - mcp_tools table
  - mcp_tool_executions table
  - Default GHL MCP tools data
- **Dependencies**: 002_organizations_and_auth.sql, 003_core_platform_tables.sql

### 8. `008_rls_policies.sql`
- **Purpose**: Row Level Security policies for all tables
- **Creates**:
  - RLS helper functions
  - Security policies for all tables
- **Dependencies**: All previous migrations (001-007)

### 9. `009_views_and_functions.sql`
- **Purpose**: Useful views and business logic functions
- **Creates**:
  - user_organization_view
  - commission_dashboard view
  - active_integrations_view
  - receipt_processing_summary view
  - team_member_commission_summary view
  - bot_conversation_metrics view
  - calculate_commission_amount function
  - get_next_workflow_node function
  - evaluate_condition function
  - update_organization_usage function
- **Dependencies**: All previous migrations (001-008)

### 10. `010_supplemental_tables.sql`
- **Purpose**: Additional tables required for complete app functionality
- **Creates**:
  - user_payment_structures table (time tracking payroll config)
  - user_payment_assignments table (active payment assignments)
  - opportunity_cache table (performance optimization)
  - incoming_messages table (webhook message processing)
  - chatbot_settings table (bot configuration)
  - workflow_checkpoints, workflow_branches, workflow_actions (legacy support)
  - user_commission_structures table (complex commission scenarios)
  - opportunity_commission_overrides table (commission exceptions)
- **Dependencies**: All previous migrations (001-009)

### 11. `011_supplemental_rls_policies.sql`
- **Purpose**: RLS policies for supplemental tables
- **Creates**:
  - Security policies for all supplemental tables
- **Dependencies**: 008_rls_policies.sql, 010_supplemental_tables.sql

## Key Improvements in Consolidated Migrations

### 1. **Eliminated Redundancy**
- Removed multiple user_api_keys table creations
- Consolidated receipt tracking tables
- Combined all ALTER TABLE statements into initial CREATE TABLE
- Merged overlapping commission tables

### 2. **Improved Structure**
- Clear multi-tenancy from the start
- Proper foreign key relationships
- Consistent naming conventions
- Optimized indexes

### 3. **Better Organization**
- Logical grouping of related tables
- Clear dependency chain
- Separated RLS policies into dedicated migration
- Views and functions at the end

### 4. **Enhanced Features**
- Complete RBAC system
- Unified team_members replacing scattered ghl_user_id
- Comprehensive commission calculation system
- Advanced chatbot workflow system

## Running the Migrations

```bash
# From the workflow-automation directory
cd supabase

# Reset database (WARNING: This will delete all data)
supabase db reset

# Or run migrations manually in order (all 11 files)
supabase migration up 001_initial_setup.sql
supabase migration up 002_organizations_and_auth.sql
supabase migration up 003_core_platform_tables.sql
supabase migration up 004_gohighlevel_integration.sql
supabase migration up 005_sales_and_commissions.sql
supabase migration up 006_chatbot_system.sql
supabase migration up 007_mcp_integration.sql
supabase migration up 008_rls_policies.sql
supabase migration up 009_views_and_functions.sql
supabase migration up 010_supplemental_tables.sql
supabase migration up 011_supplemental_rls_policies.sql
```

## Post-Migration Steps

1. **Create default organization** for development/testing
2. **Add initial admin user** to organization_members
3. **Configure integrations** (GoHighLevel, etc.)
4. **Set up MCP** if using Model Context Protocol
5. **Test RLS policies** with different user roles

## Important Notes

- These migrations assume Supabase Auth for user authentication
- The `users` table syncs with Supabase Auth
- All data is organization-scoped for multi-tenancy
- RLS policies enforce data isolation between organizations
- Team members can exist without platform login access