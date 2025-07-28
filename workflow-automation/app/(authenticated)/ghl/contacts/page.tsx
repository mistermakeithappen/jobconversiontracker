'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, CheckCircle, Plus, Settings } from 'lucide-react';
import { ContactSyncStatus } from '@/components/ghl/contact-sync-status';

interface GHLContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  tags: string[];
  dateAdded: string;
}

export default function GHLContactsPage() {
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    if (connected) {
      fetchContacts();
    }
  }, [connected]);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      const data = await response.json();
      setConnected(data.connected);
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      if (data.integrationId) {
        setIntegrationId(data.integrationId);
      }
    } catch (error) {
      console.error('Error checking GHL connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/automake/contacts');
      const data = await response.json();
      
      if (response.ok) {
        setContacts(data.contacts || []);
      } else {
        console.error('Error fetching contacts:', data.error);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/automake/sync', {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchContacts();
        alert('Contacts synced successfully!');
      } else {
        alert('Failed to sync contacts');
      }
    } catch (error) {
      console.error('Error syncing contacts:', error);
      alert('Error syncing contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/automake/connect');
      const data = await response.json();

      if (response.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('Failed to initiate connection to GoHighLevel');
      }
    } catch (error) {
      console.error('Error connecting to GHL:', error);
      alert('Error connecting to GoHighLevel');
    }
  };

  if (connectionStatus === 'checking') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Checking connection status...</p>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect GoHighLevel to manage contacts</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Link your GHL account to sync and manage contacts from your subaccount
        </p>
        <button
          onClick={handleConnect}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Connect GoHighLevel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          <p className="text-gray-600">Manage and sync contacts from GoHighLevel</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </span>
          <button
            onClick={syncData}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Contacts</span>
          </button>
        </div>
      </div>

      {/* Contact sync status component */}
      {integrationId && (
        <ContactSyncStatus integrationId={integrationId} />
      )}

      {/* Contacts list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Contacts</h3>
            <span className="text-sm text-gray-500">{contacts.length} contacts</span>
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading contacts...</p>
          </div>
        ) : contacts.length > 0 ? (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {contacts.map((contact) => (
              <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{contact.name}</h4>
                      <div className="flex items-center space-x-3 mt-0.5">
                        <span className="text-sm text-gray-500">{contact.email}</span>
                        {contact.phone && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm text-gray-500">{contact.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contact.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-1">No contacts found</h4>
            <p className="text-gray-500 mb-4">Sync your GoHighLevel data to see contacts here</p>
            <button
              onClick={syncData}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync Now</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}