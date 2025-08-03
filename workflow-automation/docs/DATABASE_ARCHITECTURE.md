# Database Architecture & System Flow Documentation

## Overview

This document outlines the complete database architecture, relationships, and data flow for the AI-powered workflow automation platform. The system uses a multi-tenant architecture with organization-based access control, role-based permissions, and efficient relational database design.

## Core Architecture Principles

### 1. Multi-Tenancy Model
- **Organization-Based**: All data belongs to an organization, not individual users
- **Subscription at Organization Level**: Billing and limits are per organization
- **Role-Based Access Control (RBAC)**: Users have roles within organizations
- **Data Isolation**: RLS policies ensure complete data isolation between organizations

### 2. User Types
- **Platform Users**: Authenticated users who can log into the system (Supabase Auth)
- **Team Members**: All people associated with an organization (sales reps, support, etc.)
- **Relationship**: Platform users can be linked to team members for unified identity

### 3. Permission Model
- **Roles**: owner, administrator, sales, bot_trainer, viewer
- **Resource-Based**: Permissions defined per resource type (workflows, bots, sales, etc.)
- **Actions**: create, read, update, delete, approve
- **Inheritance**: Owners have all permissions, cascading down through roles

## Database Schema Overview

### Core Tables

#### 1. Organizations
```sql
organizations
├── id (UUID, PK)
├── name
├── slug (unique identifier)
├── subscription_status (trial/active/inactive/cancelled)
├── subscription_plan (free/starter/professional/enterprise)
├── usage limits (max_users, max_workflows, etc.)
├── current usage counters
└── settings (JSONB)
```

#### 2. Organization Members
```sql
organization_members
├── id (UUID, PK)
├── organization_id (FK → organizations)
├── user_id (FK → auth.users)
├── role (owner/administrator/sales/bot_trainer/viewer)
├── status (active/invited/suspended)
└── custom_permissions (JSONB)
```

#### 3. Team Members
```sql
team_members
├── id (UUID, PK)
├── organization_id (FK → organizations)
├── external_id (e.g., GHL user ID)
├── email
├── full_name
├── user_id (FK → auth.users, nullable)
├── member_type (sales/support/operations)
├── commission_rate
└── commission_type
```

### Feature-Specific Tables

#### Workflow Automation
```sql
workflows
├── organization_id (FK → organizations)
├── definition (JSONB - React Flow data)
└── execution history

executions
├── organization_id (FK → organizations)
├── workflow_id (FK → workflows)
└── logs, status, results
```

#### Bot System
```sql
bots
├── organization_id (FK → organizations)
├── configuration
└── knowledge base

chatbot_workflows
├── organization_id (FK → organizations)
├── workflow nodes and connections
└── goal-based reasoning

conversation_sessions
├── bot_id (FK → bots)
├── contact information
└── conversation history
```

#### Sales & Commissions
```sql
sales_transactions
├── organization_id (FK → organizations)
├── team_member_id (FK → team_members)
├── opportunity_id
├── amount
└── payment details

commission_calculations
├── organization_id (FK → organizations)
├── team_member_id (FK → team_members)
├── transaction_id (FK → sales_transactions)
├── commission_amount
└── approval status

commission_payouts
├── organization_id (FK → organizations)
├── team_member_id (FK → team_members)
├── payout_amount
└── line items
```

#### GoHighLevel Integration
```sql
integrations
├── organization_id (FK → organizations)
├── type (gohighlevel)
├── credentials (encrypted)
└── configuration

contacts
├── organization_id (FK → organizations)
├── ghl_contact_id
└── contact details

opportunity_receipts
├── organization_id (FK → organizations)
├── opportunity_id
├── receipt image/data
└── AI processing results
```

## Data Flow Patterns

### 1. User Registration & Organization Setup
```
1. User signs up (Supabase Auth)
   ↓
2. Organization created (default: single-user org)
   ↓
3. User added as organization owner
   ↓
4. Default limits set based on plan
```

### 2. Team Member Management
```
1. Admin invites team member
   ↓
2. Team member record created
   ↓
3. If login needed: Link to auth.users
   ↓
4. Assign role and permissions
```

### 3. Sales Commission Flow
```
1. GHL webhook: Payment received
   ↓
2. Create sales_transaction
   ↓
3. Find team_member by GHL user ID
   ↓
4. Calculate commission based on rules
   ↓
5. Create commission_calculation
   ↓
6. Batch into commission_payouts
```

### 4. Bot Conversation Flow
```
1. Contact initiates conversation
   ↓
2. Create conversation_session
   ↓
3. Bot processes through workflow
   ↓
4. Execute actions (tags, appointments)
   ↓
5. Log all interactions
```

## Key Relationships

### Organization Hierarchy
```
organizations
    ↓
organization_members (platform users)
    ↓
team_members (all team members)
```

### Data Ownership
```
organization
    ├── workflows
    ├── bots
    ├── integrations
    ├── contacts
    ├── sales_transactions
    └── all other business data
```

### Permission Flow
```
role_permissions (defines what roles can do)
    ↓
organization_members.role
    ↓
RLS policies check permissions
    ↓
Access granted/denied
```

## Migration Strategy

### Phase 1: Structure Creation
1. Create organizations table
2. Create organization_members with roles
3. Create team_members to unify user references
4. Create role_permissions

### Phase 2: Data Migration
1. Create organization for each existing user
2. Migrate GHL users to team_members
3. Add organization_id to all tables
4. Update foreign key relationships

### Phase 3: Policy Updates
1. Drop user_id based RLS policies
2. Create organization-based RLS policies
3. Implement role-based access checks
4. Test all permission scenarios

## Best Practices for Development

### 1. Always Include Organization Context
```typescript
// Bad
const workflows = await supabase
  .from('workflows')
  .select('*');

// Good
const { data: org } = await getOrganization();
const workflows = await supabase
  .from('workflows')
  .select('*')
  .eq('organization_id', org.id);
```

### 2. Check Permissions Before Actions
```typescript
// Check if user can create workflows
const canCreate = await checkPermission('workflows', 'create');
if (!canCreate) {
  throw new Error('Unauthorized');
}
```

### 3. Use Team Members for People References
```typescript
// Bad: Direct GHL user ID
.eq('ghl_user_id', 'abc123')

// Good: Team member reference
.eq('team_member_id', teamMemberId)
```

### 4. Respect Data Boundaries
- Never mix data between organizations
- Always filter by organization_id
- Use RLS policies as safety net

## Security Considerations

### 1. Row Level Security (RLS)
- All tables have RLS enabled
- Policies check organization membership
- Role-based access for sensitive operations

### 2. API Security
- Service role only for migrations
- Client always uses authenticated role
- Organization context required for all operations

### 3. Data Encryption
- API keys and tokens encrypted at rest
- Sensitive configuration in encrypted JSONB
- SSL/TLS for all communications

## Performance Optimizations

### 1. Indexes
- organization_id on all tables
- Composite indexes for common queries
- Partial indexes for active records

### 2. Query Patterns
- Join through organization_id
- Use CTEs for complex permission checks
- Batch operations where possible

### 3. Caching Strategy
- Cache organization membership
- Cache role permissions
- Invalidate on changes

## Future Enhancements

### 1. Advanced Permissions
- Custom permissions per user
- Resource-level permissions
- Time-based access

### 2. Audit Trail
- Track all data changes
- User action logging
- Compliance reporting

### 3. Data Archival
- Soft delete with retention
- Historical data warehouse
- Performance optimization

## Conclusion

This architecture provides:
- **Scalability**: Multi-tenant design supports growth
- **Security**: RLS and RBAC ensure data isolation
- **Flexibility**: Role-based system adapts to needs
- **Efficiency**: Normalized design prevents duplication
- **Maintainability**: Clear structure and relationships

All future development should follow these patterns to maintain system integrity and performance.