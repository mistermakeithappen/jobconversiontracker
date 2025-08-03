# Production Setup Guide

## Database Permissions Fix

The "permission denied for schema public" error needs to be resolved by running the permissions fix script in your Supabase Dashboard.

### Steps to Fix:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Run the Permissions Fix Script**
   - Copy the entire contents of `scripts/fix-all-permissions.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

4. **Verify Permissions**
   - The script will output "Permissions setup completed successfully!" when done
   - Try signing up again - it should work now

## Environment Variables

Your `.env.local` file is already configured with the production Supabase credentials you provided:

```
NEXT_PUBLIC_SUPABASE_URL=https://hmulhwnftlsezkjuflxm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Authentication Flow

The production authentication system is now set up:

1. **Signup** (`/signup`) - Creates organization, user, and membership
2. **Login** (`/login`) - Authenticates and retrieves organization context
3. **Protected Routes** - Middleware checks for valid session

## Automatic User Setup on Signup

To ensure users are properly created with organizations on signup:

1. **Run the auto-create trigger migration**:
   - Go to SQL Editor in Supabase Dashboard
   - Run the contents of `supabase/migrations/012_auto_create_user_on_signup.sql`
   - This creates a database trigger that automatically creates user records and organizations

2. **Run the cascade delete migration**:
   - Run the contents of `supabase/migrations/013_cascade_delete_user.sql`
   - This ensures proper cleanup when users are deleted

3. **Update signup endpoint** (after triggers are created):
   - Edit `app/(auth)/signup/page.tsx`
   - Change endpoint from `/api/auth/signup-production` to `/api/auth/signup-v2`

## Account Deletion

The system supports complete account deletion:

1. **Via UI**: Users can delete their account at `/settings/account`
2. **Via API**: `DELETE /api/auth/delete-account` (requires password)
3. **Manual**: Use `scripts/delete-user-complete.sql` for admin deletion

Deletion process:
- Deletes from auth.users (triggers cascade)
- Automatically deletes user records
- Deletes organizations if user is sole owner
- Cascades to all related data (workflows, integrations, etc.)

## Next Steps After Setup

Once everything is configured:

1. Test signup flow by creating a new account
2. Verify login works with the created account
3. Check that dashboard loads with proper organization context
4. Test API endpoints to ensure they respect organization boundaries

## Testing Permissions

Before attempting signup, test database permissions:

```bash
# Test permissions endpoint
curl http://localhost:3000/api/debug/test-permissions
```

This will run several permission tests and show you exactly what's working or failing.

## Troubleshooting

If you still get permission errors after running the fix script:

1. Check Supabase Dashboard > Database > Roles to ensure service_role has proper permissions
2. Verify RLS is not blocking service_role (it shouldn't by default)
3. Check that all tables have proper ownership (should be postgres role)
4. Run the test-permissions endpoint to see detailed error messages
5. In Supabase Dashboard, try running: `GRANT ALL ON SCHEMA public TO service_role;`

## Important Notes

- The system uses real Supabase Auth, not mock auth
- All API routes use service role for database access
- RLS policies are in place but service_role bypasses them
- Organization context is automatically loaded on login