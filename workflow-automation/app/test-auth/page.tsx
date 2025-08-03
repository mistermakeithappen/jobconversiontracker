'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';

export default function TestAuthPage() {
  const [info, setInfo] = useState<any>({ loading: true });

  useEffect(() => {
    async function checkEverything() {
      const supabase = getSupabaseClient();
      
      // Get all cookies
      const allCookies = document.cookie;
      
      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      setInfo({
        loading: false,
        cookies: allCookies,
        cookieList: document.cookie.split(';').map(c => c.trim()),
        session: session ? {
          userId: session.user.id,
          email: session.user.email,
          expiresAt: new Date(session.expires_at * 1000).toLocaleString()
        } : null,
        sessionError: sessionError?.message || null,
        user: user ? {
          id: user.id,
          email: user.email
        } : null,
        userError: userError?.message || null,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        timestamp: new Date().toISOString()
      });
    }
    
    checkEverything().catch(err => {
      setInfo({ 
        loading: false, 
        error: err.message,
        timestamp: new Date().toISOString() 
      });
    });
  }, []);

  const handleDirectLogin = async () => {
    const email = prompt('Email:');
    const password = prompt('Password:');
    
    if (!email || !password) return;
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Success! Check console and refresh page.');
      console.log('Login response:', data);
      // Wait a bit then check session
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session after login:', session);
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Auth Test Page (Unprotected)</h1>
      
      <button
        onClick={handleDirectLogin}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Direct Login
      </button>
      
      <pre className="bg-gray-100 p-4 rounded overflow-auto text-gray-900">
        {JSON.stringify(info, null, 2)}
      </pre>
      
      <div className="mt-4 space-x-4">
        <a href="/login" className="text-blue-500 underline">Go to Login</a>
        <a href="/dashboard" className="text-blue-500 underline">Try Dashboard</a>
        <a href="/debug-auth" className="text-blue-500 underline">Debug Auth (Protected)</a>
      </div>
    </div>
  );
}