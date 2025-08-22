'use client';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, CheckCircle, Plus, Settings, Search, X, Mail, Phone, Calendar, Tag } from 'lucide-react';
import { getSupabaseClient } from '@/lib/auth/client';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/ui/PaywallModal';

interface GHLContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  tags: string[];
  dateAdded: string;
  customFields?: Record<string, any>;
  source?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  timezone?: string;
  dnd?: boolean;
}

export default function GHLContactsPage() {
  const { hasActiveSubscription, loading: subscriptionLoading, trialEnded } = useSubscription();
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<GHLContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<GHLContact | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const contactsPerPage = 100;
  
  const checkSyncStatus = async (syncLogId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/ghl/contacts/sync?syncLogId=${syncLogId}`, {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      const data = await response.json();
      
      if (response.ok && data) {
        const status = `${data.status}: ${data.total_contacts || 0} total, ${data.synced_contacts || 0} synced, ${data.failed_contacts || 0} failed`;
        setSyncStatus(status);
        
        // If still running, check again in 5 seconds
        if (data.status === 'started') {
          setTimeout(() => checkSyncStatus(syncLogId), 5000);
        } else {
          // Sync complete, refresh contacts
          await fetchContacts(true);
          setSyncStatus(null);
        }
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    // Check subscription status and show paywall if needed
    if (!subscriptionLoading && !hasActiveSubscription) {
      setShowPaywallModal(true);
      return;
    }
    
    if (connected && hasActiveSubscription) {
      fetchContacts();
    }
  }, [connected, hasActiveSubscription, subscriptionLoading]);

  // DEBUG: Show subscription values
  console.log('🔍 CONTACTS DEBUG:', {
    subscriptionLoading,
    hasActiveSubscription,
    trialEnded,
    shouldBlock: !subscriptionLoading && !hasActiveSubscription
  });

  // Don't show content if no subscription - BLOCK CONTENT
  if (!subscriptionLoading && !hasActiveSubscription) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-dashed border-yellow-300 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {trialEnded ? 'Trial Expired' : 'Subscription Required'}
          </h2>
          <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
            {trialEnded 
              ? 'Your trial period has ended. Upgrade to continue accessing GoHighLevel contacts management.'
              : 'Access powerful contact synchronization, management tools, and automation features with a premium subscription.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={async () => {
                try {
                  if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
                    window.location.href = '/pricing';
                    return;
                  }

                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
                      successUrl: window.location.origin + '/ghl/contacts?upgraded=true',
                      cancelUrl: window.location.href,
                    }),
                  });

                  if (!response.ok) throw new Error('Failed to create checkout session');
                  const { url } = await response.json();
                  if (url) {
                    window.location.href = url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (error) {
                  console.error('Error creating checkout session:', error);
                  window.location.href = '/pricing';
                }
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors border border-gray-300"
            >
              View Pricing
            </button>
          </div>
        </div>

      </div>
    );
  }

  const checkConnectionStatus = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/status', {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
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

  const fetchContacts = async (reset: boolean = true) => {
    if (reset) {
      setLoading(true);
      setContacts([]);
      setCurrentPage(1);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch contacts from our database instead of loading all into browser
      const url = new URL('/api/ghl/contacts/search', window.location.origin);
      url.searchParams.set('limit', '100'); // Only load first 100 for display
      
      const response = await fetch(url.toString(), {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      const data = await response.json();
      
      if (response.ok) {
        const contacts = data.contacts || [];
        
        // Transform database contacts to match the expected format
        const transformedContacts: GHLContact[] = contacts.map((c: any) => ({
          id: c.ghl_contact_id,
          name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || 'Unknown',
          email: c.email || '',
          phone: c.phone || '',
          tags: c.tags || [],
          dateAdded: c.ghl_created_at || c.created_at,
          customFields: c.custom_fields || {},
          source: c.source,
          firstName: c.first_name,
          lastName: c.last_name,
          address1: c.address1,
          city: c.city,
          state: c.state,
          postalCode: c.postal_code,
          country: c.country,
          website: c.raw_data?.website,
          timezone: c.raw_data?.timezone,
          dnd: c.raw_data?.dnd
        }));
        
        setContacts(transformedContacts);
        setFilteredContacts(transformedContacts);
        
        // Get total count from database
        const countResponse = await fetch('/api/ghl/contacts/count', {
          headers: session ? {
            'Authorization': `Bearer ${session.access_token}`,
          } : {}
        });
        if (countResponse.ok) {
          const countData = await countResponse.json();
          setTotalContacts(countData.count || transformedContacts.length);
        } else {
          setTotalContacts(transformedContacts.length);
        }
        
        // If this is the first load and no contacts exist, suggest sync
        if (data.needsSync) {
          alert('No contacts found in database. Click "Sync Contacts" to import from GoHighLevel.');
        }
      } else {
        console.error('Error fetching contacts:', data.error);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await fetchContacts(true);
      return;
    }

    setSearchLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Search in database directly
      const url = new URL('/api/ghl/contacts/search', window.location.origin);
      url.searchParams.set('limit', '100');
      url.searchParams.set('q', searchTerm);
      
      const response = await fetch(url.toString(), {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      const data = await response.json();
      
      if (response.ok) {
        const contacts = data.contacts || [];
        
        // Transform database contacts to match the expected format
        const transformedContacts: GHLContact[] = contacts.map((c: any) => ({
          id: c.ghl_contact_id,
          name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || 'Unknown',
          email: c.email || '',
          phone: c.phone || '',
          tags: c.tags || [],
          dateAdded: c.ghl_created_at || c.created_at,
          customFields: c.custom_fields || {},
          source: c.source,
          firstName: c.first_name,
          lastName: c.last_name,
          address1: c.address1,
          city: c.city,
          state: c.state,
          postalCode: c.postal_code,
          country: c.country,
          website: c.raw_data?.website,
          timezone: c.raw_data?.timezone,
          dnd: c.raw_data?.dnd
        }));
        
        setFilteredContacts(transformedContacts);
      } else {
        console.error('Error searching contacts:', data.error);
        setFilteredContacts([]);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      setFilteredContacts([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilteredContacts(contacts);
  };

  const handleContactClick = (contact: GHLContact) => {
    setSelectedContact(contact);
  };

  const closeContactDetail = () => {
    setSelectedContact(null);
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use the new database sync endpoint
      const response = await fetch('/api/ghl/contacts/sync', {
        method: 'POST',
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Contact sync started! This will run in the background.');
        // Start polling for sync status if we have a syncLogId
        if (data.syncLogId) {
          checkSyncStatus(data.syncLogId);
        }
        // Refresh the page data from database after a delay
        setTimeout(() => fetchContacts(true), 3000);
      } else {
        alert('Failed to sync contacts: ' + (data.error || 'Unknown error'));
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
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/integrations/automake/connect', {
        headers: session ? {
          'Authorization': `Bearer ${session.access_token}`,
        } : {}
      });
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

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name, email, phone, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
              disabled={false}
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Search className={`w-4 h-4 ${searchLoading ? 'animate-spin' : ''}`} />
            <span>Search</span>
          </button>
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-600">
            {searchLoading ? 'Searching...' : `Showing ${filteredContacts.length} result${filteredContacts.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </div>
        )}
      </div>

      {/* Contacts list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Contacts</h3>
            <span className="text-sm text-gray-500">{totalContacts > 0 ? `${totalContacts} total contacts • ` : ''}{
              loading ? 'Loading...' : searchTerm 
                ? `Showing ${filteredContacts.length} results`
                : `Showing ${contacts.length}`
            }</span>
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading all contacts...</p>
          </div>
        ) : filteredContacts.length > 0 ? (
          <div className="divide-y divide-gray-200" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredContacts.map((contact) => (
              <div 
                key={contact.id} 
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleContactClick(contact)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">
                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 truncate">{contact.name}</h4>
                      <div className="flex items-center space-x-3 mt-0.5">
                        <span className="text-sm text-gray-500 truncate">{contact.email}</span>
                        {contact.phone && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm text-gray-500">{contact.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    {contact.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {contact.tags.length > 3 && (
                      <span className="text-xs text-gray-400">+{contact.tags.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-1">
              {searchTerm ? 'No contacts match your search' : 'No contacts found'}
            </h4>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search terms or clear the search to see all contacts' : 'Sync your GoHighLevel data to see contacts here'}
            </p>
            <button
              onClick={() => fetchContacts()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Load Contacts</span>
            </button>
          </div>
        )}
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={closeContactDetail}
            />

            {/* Modal panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Contact Details</h2>
                  <button
                    onClick={closeContactDetail}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Header with avatar and name */}
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xl font-medium text-gray-600">
                        {selectedContact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedContact.name}</h3>
                      {selectedContact.source && (
                        <p className="text-sm text-gray-500">Source: {selectedContact.source}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">Contact Information</h4>
                      
                      {selectedContact.email && (
                        <div className="flex items-center space-x-3">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="text-gray-900">{selectedContact.email}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.phone && (
                        <div className="flex items-center space-x-3">
                          <Phone className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="text-gray-900">{selectedContact.phone}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.website && (
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <span className="text-gray-400">🌐</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Website</p>
                            <a href={selectedContact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              {selectedContact.website}
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Date Added</p>
                          <p className="text-gray-900">{new Date(selectedContact.dateAdded).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">Additional Details</h4>
                      
                      {(selectedContact.address1 || selectedContact.city || selectedContact.state) && (
                        <div className="flex items-start space-x-3">
                          <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                            <span className="text-gray-400">📍</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Address</p>
                            <div className="text-gray-900">
                              {selectedContact.address1 && <p>{selectedContact.address1}</p>}
                              {(selectedContact.city || selectedContact.state) && (
                                <p>{selectedContact.city}{selectedContact.city && selectedContact.state ? ', ' : ''}{selectedContact.state} {selectedContact.postalCode}</p>
                              )}
                              {selectedContact.country && <p>{selectedContact.country}</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedContact.timezone && (
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <span className="text-gray-400">🕐</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Timezone</p>
                            <p className="text-gray-900">{selectedContact.timezone}</p>
                          </div>
                        </div>
                      )}

                      {selectedContact.dnd !== undefined && (
                        <div className="flex items-center space-x-3">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <span className="text-gray-400">{selectedContact.dnd ? '🔕' : '🔔'}</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Do Not Disturb</p>
                            <p className="text-gray-900">{selectedContact.dnd ? 'Enabled' : 'Disabled'}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Tags */}
                      {selectedContact.tags.length > 0 && (
                        <div className="flex items-start space-x-3">
                          <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Tags</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedContact.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {selectedContact.customFields && Object.keys(selectedContact.customFields).length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Custom Fields</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(selectedContact.customFields).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-sm text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                              <p className="text-gray-900">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeContactDetail}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paywall Modal - Non-dismissible */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => {}} // Prevent dismissal
        feature="GHL Contacts"
        trialEnded={trialEnded}
      />
    </div>
  );
}