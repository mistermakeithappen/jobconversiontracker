import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('supabase-auth-token');
    
    if (!authCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
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

    // Get the current user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user data
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('User fetch error:', userDataError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization membership
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        role,
        custom_permissions,
        organizations!inner(
          id,
          name,
          slug
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember) {
      console.error('Organization fetch error:', orgError);
      return NextResponse.json({
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
        },
        organization: null,
      });
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
      },
      organization: {
        id: orgMember.organizations[0].id,
        name: orgMember.organizations[0].name,
        slug: orgMember.organizations[0].slug,
        role: orgMember.role,
      },
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization membership
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        role,
        custom_permissions,
        organizations!inner(
          id,
          name,
          slug
        )
      `)
      .eq('user_id', userId)
      .single();

    if (orgError || !orgMember) {
      console.error('Organization fetch error:', orgError);
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
        },
        organization: null,
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      organization: {
        id: orgMember.organizations[0].id,
        name: orgMember.organizations[0].name,
        slug: orgMember.organizations[0].slug,
        role: orgMember.role,
      },
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}