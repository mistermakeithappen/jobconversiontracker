import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

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
      console.error('Login error:', {
        error: authError,
        message: authError.message,
        status: authError.status,
        code: authError.code
      });
      return NextResponse.json(
        { error: authError.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json(
        { error: 'Login failed' },
        { status: 401 }
      );
    }

    // Get user's organization
    const supabaseService = getServiceSupabase();
    const { data: orgMember, error: orgError } = await supabaseService
      .from('organization_members')
      .select(`
        role,
        organizations!inner(
          id,
          name,
          slug
        )
      `)
      .eq('user_id', authData.user.id)
      .single();

    if (orgError || !orgMember) {
      console.error('Organization fetch error:', {
        error: orgError,
        userId: authData.user.id,
        email: authData.user.email
      });
      return NextResponse.json(
        { error: 'No organization found for this user' },
        { status: 404 }
      );
    }

    // Create response with auth cookies
    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.full_name || authData.user.email,
      },
      organization: {
        id: orgMember.organizations.id,
        name: orgMember.organizations.name,
        slug: orgMember.organizations.slug,
        role: orgMember.role,
      },
      success: true,
    });

    // Set secure auth cookies with correct options
    response.cookies.set('supabase-auth-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    response.cookies.set('supabase-refresh-token', authData.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}