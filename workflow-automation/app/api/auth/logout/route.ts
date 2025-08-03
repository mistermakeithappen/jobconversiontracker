import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the current session from cookies
    const cookieStore = cookies();
    
    // Clear all Supabase auth cookies
    const supabaseCookies = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase-refresh-token',
      'sb-hmulhwnftlsezkjuflxm-auth-token',
      'sb-hmulhwnftlsezkjuflxm-auth-token-code-verifier'
    ];

    supabaseCookies.forEach(cookieName => {
      cookieStore.delete(cookieName);
    });

    // Clear any mock auth cookies (for cleanup)
    cookieStore.delete('mock-user-id');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}