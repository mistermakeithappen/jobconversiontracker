import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client with session refresh capabilities
 * This should be used in API routes to ensure sessions stay fresh
 */
export function createRefreshableClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });
}

/**
 * Refreshes the session if it's about to expire
 * Returns the refreshed session or null if refresh fails
 */
export async function refreshSessionIfNeeded(accessToken: string) {
  const client = createRefreshableClient();
  
  try {
    // Set the session from the access token
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    
    if (error || !user) {
      console.error('Failed to get user from token:', error);
      return null;
    }

    // Get the current session
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Failed to get session:', sessionError);
      return null;
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes) {
      console.log('Session about to expire, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await client.auth.refreshSession();
      
      if (refreshError || !newSession) {
        console.error('Failed to refresh session:', refreshError);
        return null;
      }

      return newSession;
    }

    return session;
  } catch (error) {
    console.error('Error in session refresh:', error);
    return null;
  }
}

/**
 * Middleware helper to ensure fresh sessions in API routes
 */
export async function withFreshSession(
  request: Request,
  handler: (session: any) => Promise<Response>
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'No authorization token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await refreshSessionIfNeeded(token);
  
  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return handler(session);
}