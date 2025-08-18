import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function getAuthUser(request?: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Debug: Log all available cookies
    console.log('Available cookies:', Array.from(cookieStore.getAll()).map(c => c.name));
    
    // Create a Supabase server client that can read cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const value = cookieStore.get(name)?.value;
            console.log(`Cookie ${name}:`, value ? 'found' : 'not found');
            return value;
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth user error:', error);
      return { userId: null, user: null, error: error.message };
    }

    if (!user) {
      return { userId: null, user: null, error: 'No authenticated user' };
    }

    console.log('Cookie auth user found:', user.id, user.email);
    return { 
      userId: user.id, 
      user: user, 
      error: null 
    };
  } catch (error: any) {
    console.error('Auth error:', error);
    return { 
      userId: null, 
      user: null, 
      error: error.message || 'Authentication failed' 
    };
  }
}

export async function requireAuth(request?: NextRequest) {
  const { userId, user, error } = await getAuthUser(request);
  
  if (!userId || !user) {
    throw new Error(error || 'Authentication required');
  }
  
  return { userId, user };
}

export async function requireAuthWithOrg(request?: NextRequest) {
  const { userId, user } = await requireAuth(request);
  
  // Import here to avoid circular dependency
  const { getUserOrganization } = await import('./organization-helper');
  const organization = await getUserOrganization(userId);
  
  return { userId, user, organization };
}