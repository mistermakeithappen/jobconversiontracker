'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { User } from '@supabase/supabase-js';

interface AuthUser {
  user: User | null;
  profile: {
    id: string;
    email: string;
    full_name: string;
  } | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    role: string;
  } | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authData, setAuthData] = useState<AuthUser>({
    user: null,
    profile: null,
    organization: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function getSession() {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setAuthData({
            user: null,
            profile: null,
            organization: null,
            loading: false,
            error: sessionError.message,
          });
          return;
        }

        if (!session?.user) {
          console.log('No session found');
          setAuthData({
            user: null,
            profile: null,
            organization: null,
            loading: false,
            error: null,
          });
          return;
        }

        console.log('Found session for user:', session.user.email);

        // Try to fetch user profile and organization from database
        try {
          const response = await fetch('/api/auth/me-simple', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Loaded user data:', data);
            setAuthData({
              user: session.user,
              profile: data.user,
              organization: data.organization,
              loading: false,
              error: null,
            });
          } else {
            console.error('Failed to fetch user data:', response.status);
            // Still set the auth user even if profile fetch fails
            setAuthData({
              user: session.user,
              profile: {
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
              },
              organization: null,
              loading: false,
              error: 'Failed to load profile from database',
            });
          }
        } catch (fetchError: any) {
          console.error('Error fetching user data:', fetchError);
          // Fallback to basic user info from session
          setAuthData({
            user: session.user,
            profile: {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
            },
            organization: null,
            loading: false,
            error: 'Network error loading profile',
          });
        }
      } catch (error: any) {
        console.error('Auth error:', error);
        setAuthData({
          user: null,
          profile: null,
          organization: null,
          loading: false,
          error: error.message,
        });
      }
    }

    // Initial load
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        getSession();
      } else if (event === 'SIGNED_OUT') {
        setAuthData({
          user: null,
          profile: null,
          organization: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Call server-side logout endpoint first
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Then sign out from Supabase client
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      
      // Force redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect even if there's an error
      window.location.href = '/login';
    }
  };

  return {
    ...authData,
    signOut,
  };
}