import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    // Check for auth token
    const cookieStore = await cookies();
    const authToken = cookieStore.get('supabase-auth-token');
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let userId: string;
    
    // Handle Supabase auth token
    try {
      // Parse JWT to get user ID (basic parsing, not cryptographically secure)
      const base64Payload = authToken.value.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      userId = payload.sub;
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid auth token' },
        { status: 401 }
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
      .eq('organization_members.user_id', userId)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
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
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}