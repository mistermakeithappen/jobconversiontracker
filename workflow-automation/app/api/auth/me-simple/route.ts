import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
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
          slug,
          subscription_status,
          subscription_plan,
          trial_ends_at
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
        id: orgMember.organizations.id,
        name: orgMember.organizations.name,
        slug: orgMember.organizations.slug,
        role: orgMember.role,
        subscription_status: orgMember.organizations.subscription_status,
        subscription_plan: orgMember.organizations.subscription_plan,
        trial_ends_at: orgMember.organizations.trial_ends_at,
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
        organizations!organization_members_organization_id_fkey(
          id,
          name,
          slug,
          subscription_status,
          subscription_plan,
          trial_ends_at
        )
      `)
      .eq('organization_members.user_id', userId)
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
        subscription_status: orgMember.organizations[0].subscription_status,
        subscription_plan: orgMember.organizations[0].subscription_plan,
        trial_ends_at: orgMember.organizations[0].trial_ends_at,
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