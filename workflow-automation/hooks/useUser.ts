'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { User } from '@supabase/supabase-js';

interface UserData {
  authUser: User | null;
  profile: {
    full_name: string;
    email: string;
  } | null;
  organization: {
    id: string;
    name: string;
    role: string;
  } | null;
  loading: boolean;
}

export function useUser() {
  const [userData, setUserData] = useState<UserData>({
    authUser: null,
    profile: null,
    organization: null,
    loading: true,
  });

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = getSupabaseClient();
        
        // Get auth user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          setUserData({
            authUser: null,
            profile: null,
            organization: null,
            loading: false,
          });
          return;
        }

        // Fetch user profile and organization
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUserData({
            authUser,
            profile: data.user,
            organization: data.organization,
            loading: false,
          });
        } else {
          setUserData({
            authUser,
            profile: null,
            organization: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setUserData({
          authUser: null,
          profile: null,
          organization: null,
          loading: false,
        });
      }
    }

    loadUser();

    // Subscribe to auth changes
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return userData;
}