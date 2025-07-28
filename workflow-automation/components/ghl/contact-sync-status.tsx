'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Users, CheckCircle, XCircle, Clock, Phone, MessageSquare } from 'lucide-react';

interface ContactSyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  contacts_fetched: number;
  contacts_created: number;
  contacts_updated: number;
  error_message?: string;
}

interface ContactSyncStatusProps {
  integrationId: string;
}

export function ContactSyncStatus({ integrationId }: ContactSyncStatusProps) {
  const [syncJobs, setSyncJobs] = useState<ContactSyncJob[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchSyncStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sync/contacts?integrationId=${integrationId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSyncJobs(data.syncJobs || []);
        setTotalContacts(data.totalContacts || 0);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refresh status after sync
        setTimeout(fetchSyncStatus, 1000);
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      alert('Failed to trigger contact sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (integrationId) {
      fetchSyncStatus();
    }
  }, [integrationId]);

  const latestSync = syncJobs[0];
  const isCurrentlyRunning = latestSync?.status === 'running';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Contact Sync Status</h3>
            <p className="text-sm text-gray-600">
              {totalContacts} contacts synced for message processing
            </p>
          </div>
        </div>
        
        <button
          onClick={triggerSync}
          disabled={syncing || isCurrentlyRunning}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${(syncing || isCurrentlyRunning) ? 'animate-spin' : ''}`} />
          <span>{syncing || isCurrentlyRunning ? 'Syncing...' : 'Sync Contacts'}</span>
        </button>
      </div>

      {/* Latest Sync Summary */}
      {latestSync && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {getStatusIcon(latestSync.status)}
              <span className="text-sm font-medium text-gray-900">
                Latest Sync
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatDate(latestSync.started_at)}
            </span>
          </div>
          
          {latestSync.status === 'completed' && (
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {latestSync.contacts_fetched}
                </div>
                <div className="text-xs text-gray-600">Fetched</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {latestSync.contacts_created}
                </div>
                <div className="text-xs text-gray-600">Created</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {latestSync.contacts_updated}
                </div>
                <div className="text-xs text-gray-600">Updated</div>
              </div>
            </div>
          )}
          
          {latestSync.status === 'failed' && latestSync.error_message && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {latestSync.error_message}
            </div>
          )}
        </div>
      )}

      {/* Feature Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Receipt Processing Ready</h4>
            <p className="text-sm text-blue-700 mt-1">
              Synced contacts enable automatic receipt processing from incoming messages. 
              When users text receipt images, the system will:
            </p>
            <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
              <li>Identify the sender using phone number lookup</li>
              <li>Process receipt images with AI</li>
              <li>Match expenses to opportunities automatically</li>
              <li>Send confirmation messages via GoHighLevel</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync History */}
      {syncJobs.length > 1 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Sync History</h4>
          <div className="space-y-2">
            {syncJobs.slice(1, 6).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(job.status)}
                  <span className="text-sm text-gray-600">
                    {formatDate(job.started_at)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {job.status === 'completed' && (
                    `${job.contacts_fetched} fetched, ${job.contacts_created} created`
                  )}
                  {job.status === 'failed' && 'Failed'}
                  {job.status === 'running' && 'Running...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}