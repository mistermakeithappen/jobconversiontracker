'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}`,
      });
      
      if (error) throw error;
      
      setEmailSent(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Check your email!
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    Password reset email sent
                  </p>
                  <p className="text-sm text-blue-700">
                    We've sent a password reset link to <strong>{email}</strong>. Please check your email and click the link to reset your password.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              The link will expire in 1 hour. If you don't see the email, check your spam folder.
            </p>
            <div className="space-y-3">
              <Link
                href="/login"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Back to Sign In
              </Link>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                  setError('');
                }}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Send to different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-6">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">TextCRM</h1>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Reset your password
          </h2>
          <p className="text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`appearance-none relative block w-full px-3 py-2 border ${
                error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-1 sm:text-sm`}
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
