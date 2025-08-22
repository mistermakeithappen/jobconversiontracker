'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { User } from '@supabase/supabase-js';

type Subscription = any;

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  subscription: Subscription | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = (props: any) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      const supabase = getSupabaseClient();
      const getSubscription = async () => {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*, prices(*, products(*))')
          .in('status', ['trialing', 'active'])
          .maybeSingle();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Subscription fetch error:', error);
          return null;
        }
        setSubscription(subscription);
      };
      getSubscription();
    }
  }, [user]);

  const value = {
    user,
    isLoading,
    subscription,
  };

  return <UserContext.Provider value={value}>{props.children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider.');
  }
  return context;
};