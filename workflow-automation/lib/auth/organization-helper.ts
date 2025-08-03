// Helper functions for organization-based multi-tenancy
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface OrganizationContext {
  organizationId: string;
  role: string;
  permissions: string[];
}

/**
 * Get the user's organization context
 * This function should be used in all API routes that need organization scoping
 */
export async function getUserOrganization(userId: string): Promise<OrganizationContext | null> {
  try {
    const { data: orgMember, error } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        role,
        custom_permissions
      `)
      .eq('user_id', userId)
      .single();

    if (error || !orgMember) {
      console.error('Error fetching user organization:', error);
      return null;
    }

    return {
      organizationId: orgMember.organization_id,
      role: orgMember.role,
      permissions: orgMember.custom_permissions || []
    };
  } catch (error) {
    console.error('Error in getUserOrganization:', error);
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(context: OrganizationContext, permission: string): boolean {
  // Owners and admins have all permissions
  if (context.role === 'owner' || context.role === 'administrator') {
    return true;
  }
  
  return context.permissions.includes(permission);
}

/**
 * Get organization-scoped Supabase query filter
 * Use this to ensure all queries are organization-scoped
 */
export function orgFilter(organizationId: string) {
  return { organization_id: organizationId };
}

/**
 * Create a user and organization if they don't exist (for mock auth)
 * This is used during development to ensure mock user has proper organization setup
 */
export async function ensureMockUserOrganization(userId: string): Promise<OrganizationContext | null> {
  try {
    // Check if user exists in organization_members
    let context = await getUserOrganization(userId);
    if (context) {
      return context;
    }

    // Check if user exists in users table
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      // Create user
      await supabase
        .from('users')
        .insert({
          id: userId,
          email: 'dev@example.com',
          full_name: 'Dev User'
        });
    }

    // Check if organization exists
    let { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', 'dev-org')
      .single();

    if (!org) {
      // Create default organization
      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({
          name: 'Development Organization',
          slug: 'dev-org',
          subscription_status: 'active',
          subscription_plan: 'pro'
        })
        .select('id')
        .single();
      
      org = newOrg;
    }

    if (!org) {
      console.error('Failed to create or find organization');
      return null;
    }

    // Add user to organization as owner
    await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
        permissions: []
      });

    return {
      organizationId: org.id,
      role: 'owner',
      permissions: []
    };
  } catch (error) {
    console.error('Error ensuring mock user organization:', error);
    return null;
  }
}