import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/client';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Simplified approach - let the trigger handle everything
export async function POST(request: NextRequest) {
  console.log('Signup endpoint hit');
  try {
    const body = await request.json();
    const { email, password, fullName, organizationName } = body;

    if (!email || !password || !fullName || !organizationName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    
    // Just create the user - the trigger handles organization and membership
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        full_name: fullName,
      })
      .select()
      .single();

    if (userError || !newUser) {
      console.error('User creation error:', userError);
      throw userError || new Error('Failed to create user');
    }

    // Set mock auth cookie
    cookies().set('mock-user-id', newUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        email,
        name: fullName,
      },
      success: true,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}