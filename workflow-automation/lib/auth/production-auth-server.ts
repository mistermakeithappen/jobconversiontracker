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
    // First, try to get auth from Authorization header
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Create a Supabase client with the access token
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`
              }
            },
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          }
        );
        
        // Get the user from this authenticated client
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (!error && user) {
          console.log('Auth header user found:', user.id, user.email);
          return { 
            userId: user.id, 
            user: user, 
            error: null 
          };
        } else {
          console.error('Auth header validation failed:', error);
        }
      }
    }
    
    // Fall back to cookie-based auth
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('supabase-auth-token');
    const refreshCookie = cookieStore.get('supabase-refresh-token');
    
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
  
  // Import here to avoid circular dependency
  const { getUserOrganization } = await import('./organization-helper');
  const organization = await getUserOrganization(userId);
  
  return { userId, user, organization };
}