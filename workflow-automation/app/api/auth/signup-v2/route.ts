import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, organizationName } = await request.json();

    if (!email || !password || !fullName || !organizationName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Create Supabase client for auth
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create user with metadata that the trigger will use
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName,
        }
      }
    });

    if (authError) {
      console.error('Auth signup error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // The database trigger will automatically create:
    // 1. User record in public.users
    // 2. Organization
    // 3. Organization membership
    
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch the created organization
    const supabaseService = getServiceSupabase();
    const { data: orgMember } = await supabaseService
      .from('organization_members')
      .select(`
        organizations!inner(
          id,
          name,
          slug
        )
      `)
      .eq('user_id', authData.user.id)
      .single();

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: fullName,
      },
      organization: orgMember ? {
        id: orgMember.organizations.id,
        name: orgMember.organizations.name,
        slug: orgMember.organizations.slug,
      } : null,
      session: authData.session,
      success: true,
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}