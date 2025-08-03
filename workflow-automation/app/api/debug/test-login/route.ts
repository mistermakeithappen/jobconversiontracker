import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Create Supabase client for auth
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // Test response with simple cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        metadata: authData.user?.user_metadata,
      },
      session: !!authData.session,
      accessToken: authData.session?.access_token?.substring(0, 20) + '...',
    });

    // Set a simple test cookie
    response.cookies.set('test-cookie', 'test-value', {
      httpOnly: false, // Make it accessible from JS for testing
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    // Set auth token
    if (authData.session) {
      response.cookies.set('supabase-auth-token', authData.session.access_token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}