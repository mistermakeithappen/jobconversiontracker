'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';

export default function DebugAuthPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseClient();
      
      // Get session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check cookies
      const cookies = document.cookie.split(';').map(c => c.trim());
      const supabaseCookies = cookies.filter(c => c.startsWith('sb-'));
      
      setAuthState({
        session,
        user,
        error,
        cookies: supabaseCookies,
        timestamp: new Date().toISOString()
      });
      
      setLoading(false);
    }
    
    checkAuth();
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleTestLogin = async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'infoburganhomeservices@gmail.com',
      password: prompt('Enter password:') || ''
    });
    
    if (error) {
      alert('Login error: ' + error.message);
    } else {
      alert('Login successful! Refreshing...');
      window.location.reload();
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Authentication State</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Session Status</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(authState?.session ? {
              user_id: authState.session.user.id,
              email: authState.session.user.email,
              expires_at: new Date(authState.session.expires_at * 1000).toLocaleString(),
              token_type: authState.session.token_type
            } : null, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Current User</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(authState?.user ? {
              id: authState.user.id,
              email: authState.user.email,
              confirmed_at: authState.user.confirmed_at,
              last_sign_in_at: authState.user.last_sign_in_at
            } : null, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Supabase Cookies</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(authState?.cookies || [], null, 2)}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Error (if any)</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(authState?.error || null, null, 2)}
          </pre>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleTestLogin}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Login Here
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Test Logout
          </button>
          <button
            onClick={() => router.push('/ghl')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Go to GHL
          </button>
        </div>
      </div>
    </div>
  );
}