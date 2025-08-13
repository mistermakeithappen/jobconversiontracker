'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { postData } from '@/lib/utils/helpers';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const redirectToCustomerPortal = async () => {
    try {
      const response = await fetch('/api/auth/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redirect to customer portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to customer portal');
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      // You might want to redirect to a logged-out page or the homepage
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
      <div className="mt-8">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="text-gray-900">{user?.email || 'Loading...'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Full Name</label>
            <p className="text-gray-900">{user?.user_metadata?.full_name || 'Loading...'}</p>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">Danger Zone</h2>
          <div className="mt-4">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full">
            <h2 className="text-xl font-bold text-gray-900">Are you sure?</h2>
            <p className="mt-2 text-gray-600">
              This action is permanent and cannot be undone. All your data will be
              deleted.
            </p>
            <div className="mt-6">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Please enter your password to confirm
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            {error && (
              <div className="mt-4 flex items-center text-red-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                <p>{error}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!password}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}