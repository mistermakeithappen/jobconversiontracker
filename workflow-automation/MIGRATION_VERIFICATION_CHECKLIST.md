# Migration Verification Checklist

After running the consolidated database migrations, here's what needs to be verified and potentially updated to ensure all functionality works with the new multi-tenant architecture.

## ✅ Completed Updates

### Authentication & Organization Setup
- ✅ Created `organization-helper.ts` utility functions
- ✅ Enhanced `mock-auth-server.ts` with organization context
- ✅ Updated `company-credit-cards` API for multi-tenancy
- ✅ Updated `receipts` API for multi-tenancy  
- ✅ Updated `user-payment-structures` API for multi-tenancy
- ✅ Updated `user-payment-assignments` API for multi-tenancy
- ✅ Started updating GHL integration endpoints

### Database Verification
- ✅ Created comprehensive database verification script at `scripts/verify-database-setup.ts`

## 🔄 In Progress

### API Routes That Need Organization Scoping
The following API routes need to be updated to use `organization_id` instead of `user_id`:

1. **Integration Routes** (HIGH PRIORITY)
   - `/api/integrations/automake/opportunities/route.ts` ⚠️ (Started)
   - `/api/integrations/automake/users/route.ts`
   - `/api/integrations/automake/callback/route.ts`
   - All other GHL integration endpoints

2. **Commission & Sales Routes** (HIGH PRIORITY)
   - `/api/commissions/`
   - `/api/sales/`
   - `/api/payouts/`
   - `/api/products/`

3. **Workflow & Chatbot Routes** (MEDIUM PRIORITY)
   - `/api/workflows/`
   - `/api/chatbot/`
   - `/api/bots/`

## 🔧 Required Actions

### 1. Run Database Verification Script
```bash
cd workflow-automation
npm run tsx scripts/verify-database-setup.ts
```
This will:
- Verify all tables exist
- Create mock user organization if needed
- Test RLS policies
- Test organization scoping

### 2. Update Remaining API Routes
Each API route should follow this pattern:

```typescript
import { mockAuthServerWithOrg } from '@/lib/auth/mock-auth-server';

export async function GET/POST/PUT/DELETE(request: NextRequest) {
  try {
    const auth = await mockAuthServerWithOrg();
    if (!auth?.userId || !auth.organization) {
      return NextResponse.json({ error: 'Unauthorized or no organization' }, { status: 401 });
    }

    // Use auth.organization.organizationId for all queries
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('organization_id', auth.organization.organizationId)
      // ... rest of query
  }
}
```

### 3. Frontend Component Updates
Frontend components that interact with the API may need updates to handle the new authentication flow. Look for:
- Components that call API endpoints
- Authentication checks
- User context providers

### 4. Test Critical User Flows
After updates, test these key workflows:
1. **Receipt Processing**: Upload a receipt and verify it's processed correctly
2. **GHL Integration**: Connect GoHighLevel and sync data
3. **Commission Tracking**: Create a sale and verify commission calculation
4. **Credit Card Management**: Add/edit company credit cards
5. **User Management**: Ensure users can only see their organization's data

## 🚨 Critical Points

### Don't Add New Tables
- Use existing table structure from the 11 consolidated migrations
- Only update API logic, not database schema
- The current schema supports all required functionality

### Organization Context
- Every API call must be organization-scoped
- Use the `organization-helper.ts` utilities
- Test with multiple organizations to ensure proper isolation

### RLS Security
- Row Level Security policies enforce data isolation
- API routes using service role bypass RLS, so organization filtering in queries is critical
- Never expose data across organizations

## 🧪 Testing Strategy

### 1. Unit Testing
- Test each updated API endpoint
- Verify organization scoping works
- Test permission checks

### 2. Integration Testing  
- Test complete user workflows
- Verify GHL integration still works
- Test commission calculations

### 3. Security Testing
- Verify users can only access their organization's data
- Test RLS policies are working
- Ensure no data leakage between organizations

## 📋 Next Steps Priority Order

1. **HIGH**: Run database verification script
2. **HIGH**: Update all GHL integration endpoints 
3. **HIGH**: Update commission/sales API routes
4. **MEDIUM**: Update workflow/chatbot routes
5. **MEDIUM**: Test frontend components
6. **LOW**: Update any remaining utility functions

## 🔍 Monitoring

After updates, monitor for:
- Database connection errors
- RLS policy violations  
- Missing organization_id in queries
- Performance issues with new query patterns

## 📞 Support

If you encounter issues:
1. Check the database verification script output
2. Review the `claude-reminders.md` file for known solutions
3. Ensure all environment variables are set correctly
4. Verify mock user organization is created properly