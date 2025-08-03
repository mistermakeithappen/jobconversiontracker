import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function DELETE(request: NextRequest) {
  try {
    // Get current user
    const cookieStore = cookies();
    const authToken = cookieStore.get('supabase-auth-token');
    const mockUserId = cookieStore.get('mock-user-id');
    
    if (!authToken && !mockUserId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let userId: string;
    
    // Get user ID from auth token or mock
    if (authToken) {
      try {
        const base64Payload = authToken.value.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
        userId = payload.sub;
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid auth token' },
          { status: 401 }
        );
      }
    } else {
      userId = mockUserId!.value;
    }

    // Optional: verify password before deletion
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json(
        { error: 'Password confirmation required' },
        { status: 400 }
      );
    }

    const supabaseService = getServiceSupabase();
    
    // Verify user exists
    const { data: user, error: userError } = await supabaseService
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // For Supabase auth users, verify password
    if (authToken) {
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Try to sign in with password to verify
      const { error: authError } = await supabaseAuth.auth.signInWithPassword({
        email: user.email,
        password,
      });
      
      if (authError) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    }

    // Delete from auth.users (trigger will handle the rest)
    // Note: This requires admin privileges
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Delete user error:', deleteError);
      
      // If we can't delete from auth.users, at least delete from public tables
      // The trigger won't fire, so we need to do it manually
      await supabaseService.from('users').delete().eq('id', userId);
      
      // Clear cookies
      cookieStore.delete('supabase-auth-token');
      cookieStore.delete('supabase-refresh-token');
      cookieStore.delete('mock-user-id');
      
      return NextResponse.json({
        success: true,
        message: 'Account deleted (partial - auth user remains)',
      });
    }

    // Clear all cookies
    cookieStore.delete('supabase-auth-token');
    cookieStore.delete('supabase-refresh-token');
    cookieStore.delete('mock-user-id');

    return NextResponse.json({
      success: true,
      message: 'Account permanently deleted',
    });

  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}