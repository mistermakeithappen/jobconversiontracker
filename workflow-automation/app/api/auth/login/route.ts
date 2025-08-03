import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // In production, use Supabase Auth
    // For now, we'll implement a simple check against the users table
    
    // For mock auth in development
    if (process.env.NODE_ENV === 'development') {
      // Check if this is the dev user
      if (email === 'dev@example.com' && password === 'devpassword') {
        // Set mock auth cookie
        cookies().set('mock-user-id', 'af8ba507-b380-4da8-a1e2-23adee7497d5', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });

        return NextResponse.json({
          user: {
            id: 'af8ba507-b380-4da8-a1e2-23adee7497d5',
            email: 'dev@example.com',
            name: 'Dev User',
          },
          success: true,
        });
      }
    }

    // TODO: Implement real Supabase Auth
    // const { data, error } = await supabase.auth.signInWithPassword({
    //   email,
    //   password,
    // });

    // For now, return error
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}