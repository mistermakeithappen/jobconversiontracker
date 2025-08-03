import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabaseService = getServiceSupabase();

    // Check if user exists in users table
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('email', email)
      .single();

    // Check if user has organization membership
    let orgMembership = null;
    if (user) {
      const { data: membership, error: memberError } = await supabaseService
        .from('organization_members')
        .select(`
          role,
          status,
          created_at,
          organizations!inner(
            id,
            name,
            slug
          )
        `)
        .eq('user_id', user.id)
        .single();

      orgMembership = membership;
    }

    // Check auth.users table (this might fail due to RLS)
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { users: authUsers } } = await supabaseAuth.auth.admin.listUsers({
      filter: `email.eq.${email}`,
      page: 1,
      perPage: 1
    });

    const authUser = authUsers?.[0];

    return NextResponse.json({
      publicUser: user || null,
      organizationMembership: orgMembership || null,
      authUser: authUser ? {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        confirmed_at: authUser.confirmed_at,
      } : null,
      summary: {
        existsInUsersTable: !!user,
        hasOrganization: !!orgMembership,
        existsInAuth: !!authUser,
        emailConfirmed: !!authUser?.email_confirmed_at,
      }
    });
  } catch (error: any) {
    console.error('Check user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}