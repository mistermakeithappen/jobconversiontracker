import { GHL_CONFIG, GHL_ENDPOINTS } from './config';
import { decrypt } from '@/lib/utils/encryption';

export interface GHLTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  locationId: string;
  companyId: string;
  userId: string;
}

export class GHLClient {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;
  private locationId: string;
  private onTokenRefresh?: (tokens: GHLTokens) => Promise<void>;

  constructor(tokens: GHLTokens, onTokenRefresh?: (tokens: GHLTokens) => Promise<void>) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.expiresAt = tokens.expiresAt;
    this.locationId = tokens.locationId || '';
    this.onTokenRefresh = onTokenRefresh;
    
    console.log('GHL Client initialized with locationId:', this.locationId);
    if (!this.locationId) {
      console.warn('GHL Client initialized without locationId - some API calls may fail');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch(GHL_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: GHL_CONFIG.clientId,
          client_secret: GHL_CONFIG.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || this.refreshToken;
      this.expiresAt = Date.now() + (data.expires_in * 1000);

      // Call the callback to persist new tokens
      if (this.onTokenRefresh) {
        await this.onTokenRefresh({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt,
          locationId: this.locationId,
          companyId: data.companyId || '',
          userId: data.userId || ''
        });
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    // Check if token needs refresh (5 minutes buffer)
    if (Date.now() >= this.expiresAt - (5 * 60 * 1000)) {
      console.log('Token expired, refreshing...');
      await this.refreshAccessToken();
    }

    const url = `${GHL_CONFIG.apiBaseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Version': GHL_CONFIG.apiVersion,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    
    // Log the first few characters of the token for debugging (not the full token for security)
    console.log('Using authorization token starting with:', this.accessToken.substring(0, 20) + '...');
    
    console.log('Making GHL API request:', {
      url,
      method: options.method || 'GET',
      endpoint,
      tokenExpiry: new Date(this.expiresAt).toISOString(),
      currentTime: new Date().toISOString()
    });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      console.log('Got 401, attempting token refresh...');
      // Try refreshing token once and retry
      await this.refreshAccessToken();
      
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        console.error('Retry after token refresh failed:', {
          status: retryResponse.status,
          statusText: retryResponse.statusText,
          body: errorText
        });
        throw new Error(`API request failed after token refresh: ${retryResponse.statusText}`);
      }

      return retryResponse.json();
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL API Response Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: response.url
      });
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText };
      }
      
      throw new Error(error.message || `API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Contacts API
  async getContacts(params?: {
    limit?: number;
    startAfterId?: string;
    query?: string;
    locationId?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: params?.locationId || this.locationId,
      limit: String(params?.limit || 100), // GHL supports up to 100
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.query && { query: params.query }),
    });

    return this.makeRequest(`${GHL_ENDPOINTS.contacts.list}?${queryParams}`);
  }

  async getContact(contactId: string) {
    return this.makeRequest(GHL_ENDPOINTS.contacts.get(contactId));
  }

  async createContact(contactData: any) {
    return this.makeRequest(GHL_ENDPOINTS.contacts.create, {
      method: 'POST',
      body: JSON.stringify({
        ...contactData,
        locationId: contactData.locationId || this.locationId,
      }),
    });
  }

  async updateContact(contactId: string, contactData: any) {
    return this.makeRequest(GHL_ENDPOINTS.contacts.update(contactId), {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
  }

  async getAllContacts(params?: {
    locationId?: string;
    query?: string;
    maxResults?: number;
  }) {
    console.log('Fetching ALL contacts with pagination...');
    
    const allContacts: any[] = [];
    let startAfterId: string | undefined = undefined;
    let totalFetched = 0;
    const maxResults = params?.maxResults || 10000; // Default safety limit
    const batchSize = 100; // Maximum per request
    let requestCount = 0;
    
    try {
      do {
        requestCount++;
        console.log(`Fetching contact batch ${requestCount} (startAfterId: ${startAfterId || 'none'})`);
        
        const queryParams = new URLSearchParams({
          locationId: params?.locationId || this.locationId,
          limit: String(batchSize),
          ...(startAfterId && { startAfterId }),
          ...(params?.query && { query: params.query }),
        });

        const response = await this.makeRequest(`${GHL_ENDPOINTS.contacts.list}?${queryParams}`);
        
        const batchContacts = response.contacts || [];
        allContacts.push(...batchContacts);
        totalFetched += batchContacts.length;
        
        console.log(`Contact batch ${requestCount}: ${batchContacts.length} contacts, Total: ${totalFetched}`);
        
        // Check if we have more data to fetch
        startAfterId = response.meta?.startAfterId;
        
        // Safety checks
        if (totalFetched >= maxResults) {
          console.log(`Reached maximum limit of ${maxResults} contacts`);
          break;
        }
        
        if (requestCount >= 100) { // Prevent infinite loops
          console.log('Reached maximum request limit (100 requests)');
          break;
        }
        
        // If we got less than the batch size, we're probably at the end
        if (batchContacts.length < batchSize) {
          console.log('Received partial batch, likely reached end of contact data');
          break;
        }
        
        // Small delay between requests to be respectful to the API
        if (startAfterId) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } while (startAfterId);
      
      console.log(`Contact pagination complete: ${totalFetched} total contacts fetched in ${requestCount} requests`);
      
      return {
        contacts: allContacts,
        total: totalFetched,
        requestCount,
        meta: {
          totalFetched,
          requestCount,
          maxResultsReached: totalFetched >= maxResults
        }
      };
      
    } catch (error) {
      console.error('Error in getAllContacts:', error);
      return {
        contacts: allContacts, // Return what we got so far
        total: totalFetched,
        requestCount,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        meta: {
          totalFetched,
          requestCount,
          errorOccurred: true
        }
      };
    }
  }

  // Pipelines API
  async getPipelines() {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
    });

    return this.makeRequest(`${GHL_ENDPOINTS.pipelines.list}?${queryParams}`);
  }

  // Opportunities API
  async getOpportunities(params?: {
    limit?: number;
    startAfterId?: string;
    locationId?: string;
    pipelineId?: string;
    includeAll?: boolean;
  }) {
    console.log('Fetching opportunities using search endpoint...');
    
    try {
      const searchParams = {
        location_id: params?.locationId || this.locationId,
        limit: params?.limit || 100,
        ...(params?.startAfterId && { startAfterId: params.startAfterId }),
        ...(params?.pipelineId && { pipelineId: params.pipelineId })
      };

      const queryParams = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      console.log('Searching opportunities with params:', searchParams);
      
      const response = await this.makeRequest(`${GHL_ENDPOINTS.opportunities.search}?${queryParams}`);
      
      console.log('Opportunities search response:', {
        count: response.opportunities?.length || 0,
        meta: response.meta
      });

      return {
        opportunities: response.opportunities || [],
        total: response.meta?.total || response.opportunities?.length || 0,
        meta: response.meta
      };
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      
      // If the search endpoint fails, fall back to empty result with error message
      return {
        opportunities: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to fetch opportunities from GoHighLevel'
      };
    }
  }

  async searchOpportunities(params?: {
    limit?: number;
    startAfterId?: string;
    locationId?: string;
    pipelineId?: string;
    query?: string;
    status?: string;
    assignedTo?: string;
    contactId?: string;
  }) {
    console.log('Searching opportunities with advanced filters...');
    
    const searchParams = {
      location_id: params?.locationId || this.locationId,
      limit: params?.limit || 100,
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.pipelineId && { pipelineId: params.pipelineId }),
      ...(params?.query && { query: params.query }),
      ...(params?.status && { status: params.status }),
      ...(params?.assignedTo && { assignedTo: params.assignedTo }),
      ...(params?.contactId && { contact_id: params.contactId })
    };

    const queryParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    console.log('Advanced opportunity search params:', searchParams);
    
    const response = await this.makeRequest(`${GHL_ENDPOINTS.opportunities.search}?${queryParams}`);
    
    return {
      opportunities: response.opportunities || [],
      total: response.meta?.total || response.opportunities?.length || 0,
      meta: response.meta
    };
  }

  async getAllOpportunities(params?: {
    locationId?: string;
    pipelineId?: string;
    query?: string;
    status?: string;
    assignedTo?: string;
    contactId?: string;
    maxResults?: number; // Safety limit to prevent infinite loops
  }) {
    console.log('Fetching ALL opportunities with pagination...');
    
    const allOpportunities: any[] = [];
    let startAfterId: string | undefined = undefined;
    let totalFetched = 0;
    const maxResults = params?.maxResults || 10000; // Default safety limit
    const batchSize = 100; // Maximum per request
    let requestCount = 0;
    
    try {
      do {
        requestCount++;
        console.log(`Fetching batch ${requestCount} (startAfterId: ${startAfterId || 'none'})`);
        
        const searchParams = {
          location_id: params?.locationId || this.locationId,
          limit: batchSize,
          ...(startAfterId && { startAfterId }),
          ...(params?.pipelineId && { pipelineId: params.pipelineId }),
          ...(params?.query && { query: params.query }),
          ...(params?.status && { status: params.status }),
          ...(params?.assignedTo && { assignedTo: params.assignedTo }),
          ...(params?.contactId && { contact_id: params.contactId })
        };

        const queryParams = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });

        const response = await this.makeRequest(`${GHL_ENDPOINTS.opportunities.search}?${queryParams}`);
        
        const batchOpportunities = response.opportunities || [];
        allOpportunities.push(...batchOpportunities);
        totalFetched += batchOpportunities.length;
        
        console.log(`Batch ${requestCount}: ${batchOpportunities.length} opportunities, Total: ${totalFetched}`);
        
        // Check if we have more data to fetch
        startAfterId = response.meta?.startAfterId;
        
        // Safety checks
        if (totalFetched >= maxResults) {
          console.log(`Reached maximum limit of ${maxResults} opportunities`);
          break;
        }
        
        if (requestCount >= 100) { // Prevent infinite loops
          console.log('Reached maximum request limit (100 requests)');
          break;
        }
        
        // If we got less than the batch size, we're probably at the end
        if (batchOpportunities.length < batchSize) {
          console.log('Received partial batch, likely reached end of data');
          break;
        }
        
        // Small delay between requests to be respectful to the API
        if (startAfterId) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } while (startAfterId);
      
      console.log(`Pagination complete: ${totalFetched} total opportunities fetched in ${requestCount} requests`);
      
      return {
        opportunities: allOpportunities,
        total: totalFetched,
        requestCount,
        meta: {
          totalFetched,
          requestCount,
          maxResultsReached: totalFetched >= maxResults
        }
      };
      
    } catch (error) {
      console.error('Error in getAllOpportunities:', error);
      return {
        opportunities: allOpportunities, // Return what we got so far
        total: totalFetched,
        requestCount,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        meta: {
          totalFetched,
          requestCount,
          errorOccurred: true
        }
      };
    }
  }

  async getOpportunity(opportunityId: string) {
    return this.makeRequest(GHL_ENDPOINTS.opportunities.get(opportunityId));
  }

  async createOpportunity(opportunityData: any) {
    return this.makeRequest(GHL_ENDPOINTS.opportunities.create, {
      method: 'POST',
      body: JSON.stringify({
        ...opportunityData,
        locationId: opportunityData.locationId || this.locationId,
      }),
    });
  }

  // Forms API
  async getForms() {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
    });

    return this.makeRequest(`${GHL_ENDPOINTS.forms.list}?${queryParams}`);
  }

  async getFormSubmissions(formId: string, params?: {
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams({
      limit: String(params?.limit || 20),
      offset: String(params?.offset || 0),
    });

    return this.makeRequest(`${GHL_ENDPOINTS.forms.submissions(formId)}?${queryParams}`);
  }

  // Appointments API
  async getAppointments(params?: {
    startDate?: string;
    endDate?: string;
    calendarId?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
      ...(params?.startDate && { startDate: params.startDate }),
      ...(params?.endDate && { endDate: params.endDate }),
      ...(params?.calendarId && { calendarId: params.calendarId }),
    });

    return this.makeRequest(`${GHL_ENDPOINTS.calendars.appointments}?${queryParams}`);
  }

  // Location API
  async getLocation() {
    return this.makeRequest(GHL_ENDPOINTS.locations.get(this.locationId));
  }
  
  async getAccessibleLocations() {
    // This endpoint doesn't require locationId
    return this.makeRequest(GHL_ENDPOINTS.locations.list);
  }
  
  // User API
  async getCurrentUser() {
    // This endpoint returns the authenticated user's info
    return this.makeRequest(GHL_ENDPOINTS.users.me);
  }
  
  async getLocationUsers(params?: {
    limit?: number;
    startAfter?: string;
    locationId?: string;
  }) {
    const locationId = params?.locationId || this.locationId;
    const queryParams = new URLSearchParams({
      locationId: locationId,
      ...(params?.startAfter && { startAfter: params.startAfter }),
    });

    console.log(`Fetching users from GoHighLevel for location: ${locationId}`);
    
    // Use the working endpoint: /users/ with locationId parameter (no limit parameter)
    return this.makeRequest(`${GHL_ENDPOINTS.users.list}?${queryParams}`);
  }
  
  async searchUsers(params?: {
    limit?: number;
    startAfter?: string;
    locationId?: string;
    query?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: params?.locationId || this.locationId,
      limit: String(params?.limit || 100),
      ...(params?.startAfter && { startAfter: params.startAfter }),
      ...(params?.query && { query: params.query }),
    });

    return this.makeRequest(`${GHL_ENDPOINTS.users.search}?${queryParams}`);
  }
  
  // Conversations & Messaging API
  async getConversations(params?: {
    locationId?: string;
    limit?: number;
    startAfterId?: string;
    contactId?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: params?.locationId || this.locationId,
      limit: String(params?.limit || 20),
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.contactId && { contactId: params.contactId })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.conversations.list}?${queryParams}`);
  }
  
  async getConversation(conversationId: string) {
    return this.makeRequest(GHL_ENDPOINTS.conversations.get(conversationId));
  }
  
  async getMessages(conversationId: string, params?: {
    limit?: number;
    lastMessageId?: string;
  }) {
    const queryParams = new URLSearchParams({
      limit: String(params?.limit || 20),
      ...(params?.lastMessageId && { lastMessageId: params.lastMessageId })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.conversations.messages(conversationId)}?${queryParams}`);
  }
  
  async sendMessage(conversationId: string, messageData: {
    type: 'SMS' | 'Email' | 'WhatsApp' | 'GMB';
    message: string;
    subject?: string; // For email
    attachments?: Array<{
      url: string;
      fileName: string;
    }>;
  }) {
    return this.makeRequest(GHL_ENDPOINTS.conversations.sendMessage(conversationId), {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  }
  
  async sendSMS(contactId: string, message: string) {
    // First, try to find existing conversation with this contact
    const conversations = await this.getConversations({ contactId });
    
    let conversationId: string;
    
    if (conversations.conversations && conversations.conversations.length > 0) {
      // Use existing conversation
      conversationId = conversations.conversations[0].id;
    } else {
      // Create new conversation
      const newConversation = await this.makeRequest(GHL_ENDPOINTS.conversations.createConversation, {
        method: 'POST',
        body: JSON.stringify({
          locationId: this.locationId,
          contactId: contactId
        })
      });
      conversationId = newConversation.conversation.id;
    }
    
    // Send the message
    return this.sendMessage(conversationId, {
      type: 'SMS',
      message
    });
  }
  
  async sendSMSToPhone(phoneNumber: string, message: string) {
    // Create conversation with phone number
    const newConversation = await this.makeRequest(GHL_ENDPOINTS.conversations.createConversation, {
      method: 'POST',
      body: JSON.stringify({
        locationId: this.locationId,
        phone: phoneNumber
      })
    });
    
    const conversationId = newConversation.conversation.id;
    
    // Send the message
    return this.sendMessage(conversationId, {
      type: 'SMS',
      message
    });
  }
}

// Helper function to create a GHL client from encrypted tokens
export async function createGHLClient(
  encryptedTokens: string,
  onTokenRefresh?: (tokens: GHLTokens) => Promise<void>
): Promise<GHLClient> {
  const decryptedData = decrypt(encryptedTokens);
  const tokens: GHLTokens = JSON.parse(decryptedData);
  return new GHLClient(tokens, onTokenRefresh);
}