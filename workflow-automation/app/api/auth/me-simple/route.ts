import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

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
        id: orgMember.organizations.id,
        name: orgMember.organizations.name,
        slug: orgMember.organizations.slug,
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