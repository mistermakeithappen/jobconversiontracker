import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Create a Supabase client for service-level operations
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get authenticated user from cookies
export async function getAuthUser(request?: NextRequest) {
  try {
    // Get cookies from the request or from next/headers
    let authCookie: { name: string; value: string } | undefined;
    let refreshCookie: { name: string; value: string } | undefined;

    if (request) {
      // If we have a request object, get cookies from it
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) {
            acc[name] = decodeURIComponent(value);
          }
          return acc;
        }, {} as Record<string, string>);
        
        authCookie = cookies['sb-access-token'] ? { name: 'sb-access-token', value: cookies['sb-access-token'] } : undefined;
        refreshCookie = cookies['sb-refresh-token'] ? { name: 'sb-refresh-token', value: cookies['sb-refresh-token'] } : undefined;
      }
    } else {
      // Use next/headers for server components
    const cookieStore = await cookies();
      authCookie = cookieStore.get('sb-access-token');
      refreshCookie = cookieStore.get('sb-refresh-token');
    }
    
    if (!authCookie) {
      return { userId: null, user: null, error: 'No auth cookie found' };
    }
    
    // Create a Supabase client with the auth token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${authCookie.value}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Get the current user
    let { data: { user }, error } = await supabase.auth.getUser();
    
    // If token is expired and we have a refresh token, try to refresh
    if (error && error.message.includes('token is expired') && refreshCookie) {
      console.log('Access token expired, attempting refresh...');
      
      // Create a new client to handle the refresh
      const refreshSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Set the session with both tokens to trigger refresh
      const { data: sessionData, error: refreshError } = await refreshSupabase.auth.setSession({
        access_token: authCookie.value,
        refresh_token: refreshCookie.value
      });
      
      if (!refreshError && sessionData?.session) {
        // Update cookies with new tokens
        const newAccessToken = sessionData.session.access_token;
        const newRefreshToken = sessionData.session.refresh_token;
        
        // Return the refreshed user data
        user = sessionData.user;
        error = null;
        
        // Note: In a production app, you'd want to update the cookies here
        // But since we can't modify cookies in a GET request, the client should handle this
        console.log('Token refreshed successfully');
      } else {
        console.error('Token refresh failed:', refreshError);
      }
    }
    
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
  
  // Import here to avoid circular dependency - using dynamic import
  const { getUserOrganization } = await import('./organization-helper');
  const organization = await getUserOrganization(userId);
  
  return { userId, user, organization };
}