import { GHL_CONFIG, GHL_ENDPOINTS } from './config';
import { decrypt } from '@/lib/utils/encryption';
import { GHLMCPClient, createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';

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
  private mcpClient?: GHLMCPClient;
  private mcpEnabled: boolean = false;

  constructor(tokens: GHLTokens, onTokenRefresh?: (tokens: GHLTokens) => Promise<void>) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.expiresAt = tokens.expiresAt;
    this.locationId = tokens.locationId || '';
    this.onTokenRefresh = onTokenRefresh;
    
    if (!this.locationId) {
      console.warn('GHL Client initialized without locationId - some API calls may fail');
    }
  }

  // Initialize MCP client if credentials are available
  async initializeMCP(mcpToken?: string): Promise<boolean> {
    try {
      if (!mcpToken || !this.locationId) {
        return false;
      }

      const client = await createGHLMCPClient({
        mcpToken,
        locationId: this.locationId
      });

      if (client) {
        this.mcpClient = client;
        this.mcpEnabled = true;
        return true;
      }
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
    }
    return false;
  }

  // Check if MCP is available
  hasMCP(): boolean {
    return this.mcpEnabled && !!this.mcpClient;
  }

  // Get the location ID
  getLocationId(): string {
    return this.locationId;
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
        const errorText = await response.text();
        console.error('Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          refreshToken: this.refreshToken ? 'exists' : 'missing'
        });
        throw new Error(`Token refresh failed: ${response.statusText} - ${errorText}`);
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
    

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Check if it's a scope issue before trying to refresh
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // If it's a scope authorization error, don't try to refresh
      if (errorData.message && errorData.message.includes('not authorized for this scope')) {
        console.error('GHL API Scope Error:', {
          status: response.status,
          message: errorData.message,
          url: response.url
        });
        const error = new Error(errorData.message || 'Not authorized for this scope');
        (error as any).statusCode = 401;
        (error as any).isAuthorizationError = true;
        throw error;
      }
      
      // Otherwise, try refreshing token once and retry
      await this.refreshAccessToken();
      
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        console.error('Retry after token refresh failed:', {
          status: retryResponse.status,
          statusText: retryResponse.statusText,
          body: retryErrorText
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

  // Make request using Private Integration Token (for estimates and other PIT-only endpoints)
  async makeRequestWithPIT(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized. Private Integration Token required.');
    }
    
    const url = `${GHL_CONFIG.apiBaseUrl}${endpoint}`;
    
    // Get the PIT token from MCP client
    const pitToken = (this.mcpClient as any).mcpToken;
    if (!pitToken) {
      throw new Error('Private Integration Token not available');
    }
    
    const headers = {
      'Authorization': `Bearer ${pitToken}`,
      'Version': GHL_CONFIG.apiVersion,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL PIT API Response Error:', {
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
    startAfter?: number;
    query?: string;
    locationId?: string;
  }) {
    // Try MCP first if available
    if (this.mcpEnabled && this.mcpClient) {
      try {
        const result = await this.mcpClient.getContacts({
          limit: params?.limit,
          query: params?.query
        });
        return result;
      } catch (error) {
      }
    }
    const queryParams = new URLSearchParams({
      locationId: params?.locationId || this.locationId,
      limit: String(params?.limit || 100), // GHL supports up to 100
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.startAfter && { startAfter: String(params.startAfter) }),
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
    
    const allContacts: any[] = [];
    let startAfterId: string | undefined = undefined;
    let totalFetched = 0;
    const maxResults = params?.maxResults || 10000; // Default safety limit
    const batchSize = 100; // Maximum per request
    let requestCount = 0;
    
    try {
      do {
        requestCount++;
        
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
        
        
        // Check if we have more data to fetch
        startAfterId = response.meta?.startAfterId;
        
        // Safety checks
        if (totalFetched >= maxResults) {
          break;
        }
        
        if (requestCount >= 100) { // Prevent infinite loops
          break;
        }
        
        // If we got less than the batch size, we're probably at the end
        if (batchContacts.length < batchSize) {
          break;
        }
        
        // Small delay between requests to be respectful to the API
        if (startAfterId) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } while (startAfterId);
      
      
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
    // Try MCP first if available
    if (this.mcpEnabled && this.mcpClient) {
      try {
        const result = await this.mcpClient.getPipelines();
        return result;
      } catch (error) {
      }
    }

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

      
      const response = await this.makeRequest(`${GHL_ENDPOINTS.opportunities.search}?${queryParams}`);
      
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
    
    const allOpportunities: any[] = [];
    let startAfterId: string | undefined = undefined;
    let totalFetched = 0;
    const maxResults = params?.maxResults || 10000; // Default safety limit
    const batchSize = 100; // Maximum per request
    let requestCount = 0;
    
    try {
      do {
        requestCount++;
        
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
        
        
        // Check if we have more data to fetch
        startAfterId = response.meta?.startAfterId;
        
        // Safety checks
        if (totalFetched >= maxResults) {
          break;
        }
        
        if (requestCount >= 100) { // Prevent infinite loops
          break;
        }
        
        // If we got less than the batch size, we're probably at the end
        if (batchOpportunities.length < batchSize) {
          break;
        }
        
        // Small delay between requests to be respectful to the API
        if (startAfterId) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } while (startAfterId);
      
      
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
  
  // Calendars API
  async getCalendars() {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
    });

    return this.makeRequest(`${GHL_ENDPOINTS.calendars.list}?${queryParams}`);
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
    // Try MCP first if available
    if (this.mcpEnabled && this.mcpClient) {
      try {
        const result = await this.mcpClient.getUsers();
        return result;
      } catch (error) {
      }
    }
    const locationId = params?.locationId || this.locationId;
    const queryParams = new URLSearchParams({
      locationId: locationId,
      ...(params?.startAfter && { startAfter: params.startAfter }),
    });

    
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
  
  // Products API
  async getProducts(params?: {
    limit?: number;
    startAfterId?: string;
    locationId?: string;
  }) {
    const locationId = params?.locationId || this.locationId;
    
    if (!locationId) {
      console.error('No locationId available for products request');
      return { products: [], error: 'Location ID is required for fetching products' };
    }
    
    const queryParams = new URLSearchParams({
      locationId: locationId,
      limit: String(params?.limit || 100),
      ...(params?.startAfterId && { startAfterId: params.startAfterId })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.products.list}?${queryParams}`);
  }
  
  async searchProducts(params?: {
    limit?: number;
    startAfterId?: string;
    locationId?: string;
    query?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: params?.locationId || this.locationId,
      limit: String(params?.limit || 100),
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.query && { query: params.query })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.products.search}?${queryParams}`);
  }

  async getProductPrices(productId: string) {
    if (!productId) {
      console.error('Product ID is required for fetching prices');
      return { prices: [], error: 'Product ID is required' };
    }
    
    try {
      return await this.makeRequest(GHL_ENDPOINTS.products.prices(productId));
    } catch (error) {
      console.error(`Error fetching prices for product ${productId}:`, error);
      return { prices: [] };
    }
  }
  
  async getAllProducts(params?: {
    locationId?: string;
    maxResults?: number;
  }) {
    
    const allProducts: any[] = [];
    let startAfterId: string | undefined = undefined;
    let totalFetched = 0;
    const maxResults = params?.maxResults || 1000; // Lower limit for products
    const batchSize = 100;
    let requestCount = 0;
    
    try {
      do {
        requestCount++;
        
        const response = await this.getProducts({
          locationId: params?.locationId,
          limit: batchSize,
          startAfterId
        });
        
        
        // Handle different possible response structures
        const batchProducts = response.products || response.data || response || [];
        const productsArray = Array.isArray(batchProducts) ? batchProducts : [];
        
        allProducts.push(...productsArray);
        totalFetched += productsArray.length;
        
        
        // Check for pagination - GoHighLevel uses different pagination markers
        if (response.meta?.startAfterId) {
          startAfterId = response.meta.startAfterId;
        } else if (productsArray.length > 0) {
          // Use the last product's ID as the startAfterId
          const lastProduct = productsArray[productsArray.length - 1];
          startAfterId = lastProduct._id || lastProduct.id;
        } else {
          startAfterId = undefined;
        }
        
        if (totalFetched >= maxResults || requestCount >= 50 || batchProducts.length < batchSize) {
          break;
        }
        
        if (startAfterId) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } while (startAfterId);
      
      
      return {
        products: allProducts,
        total: totalFetched,
        requestCount
      };
      
    } catch (error) {
      console.error('Error fetching all products:', error);
      return {
        products: allProducts,
        total: totalFetched,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async getProduct(productId: string) {
    return this.makeRequest(GHL_ENDPOINTS.products.get(productId));
  }
  
  // Payments API
  async getPaymentTransactions(params?: {
    limit?: number;
    startAfterId?: string;
    startAfter?: Date;
    endBefore?: Date;
    contactId?: string;
    subscriptionId?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
      limit: String(params?.limit || 100),
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.startAfter && { startAfter: params.startAfter.toISOString() }),
      ...(params?.endBefore && { endBefore: params.endBefore.toISOString() }),
      ...(params?.contactId && { contactId: params.contactId }),
      ...(params?.subscriptionId && { subscriptionId: params.subscriptionId })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.payments.list}?${queryParams}`);
  }
  
  async getPaymentTransaction(transactionId: string) {
    return this.makeRequest(GHL_ENDPOINTS.payments.get(transactionId));
  }
  
  async getPaymentOrders(params?: {
    limit?: number;
    startAfterId?: string;
    contactId?: string;
  }) {
    const queryParams = new URLSearchParams({
      locationId: this.locationId,
      limit: String(params?.limit || 100),
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.contactId && { contactId: params.contactId })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.payments.orders}?${queryParams}`);
  }
  
  async getSubscriptions(params?: {
    limit?: number;
    startAfterId?: string;
    contactId?: string;
    status?: 'active' | 'canceled' | 'past_due' | 'trialing';
  }) {
    const queryParams = new URLSearchParams({
      altId: this.locationId,
      altType: 'location',
      limit: String(params?.limit || 100),
      ...(params?.startAfterId && { startAfterId: params.startAfterId }),
      ...(params?.contactId && { contactId: params.contactId }),
      ...(params?.status && { status: params.status })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.payments.subscriptions}?${queryParams}`);
  }
  
  async getInvoices(params?: {
    limit?: number;
    offset?: number;
    startAfterId?: string;
    contactId?: string;
    status?: 'draft' | 'sent' | 'paid' | 'void';
  }) {
    const queryParams = new URLSearchParams({
      altId: this.locationId,
      altType: 'location',
      limit: String(params?.limit || 100),
      offset: String(params?.offset || 0),
      ...(params?.contactId && { contactId: params.contactId }),
      ...(params?.status && { status: params.status })
    });

    return this.makeRequest(`${GHL_ENDPOINTS.payments.invoices}?${queryParams}`);
  }
  
  async getInvoice(invoiceId: string) {
    return this.makeRequest(GHL_ENDPOINTS.payments.invoice(invoiceId));
  }
  
  async getEstimates(params?: {
    limit?: number;
    offset?: number;
    startAt?: string;
    endAt?: string;
    search?: string;
    contactId?: string;
    status?: 'all' | 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced' | 'viewed';
  }) {
    // Build query params according to GHL documentation
    const queryParams = new URLSearchParams();
    
    // Required parameters
    queryParams.append('altId', this.locationId);
    queryParams.append('altType', 'location');
    queryParams.append('limit', String(params?.limit || 100));
    queryParams.append('offset', String(params?.offset || 0));
    
    // Optional parameters
    if (params?.contactId) queryParams.append('contactId', params.contactId);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.startAt) queryParams.append('startAt', params.startAt);
    if (params?.endAt) queryParams.append('endAt', params.endAt);
    if (params?.search) queryParams.append('search', params.search);

    // Estimates require PIT token, use makeRequestWithPIT if available
    if (this.mcpEnabled && this.mcpClient) {
      return this.makeRequestWithPIT(`${GHL_ENDPOINTS.estimates.list}?${queryParams}`);
    }
    
    return this.makeRequest(`${GHL_ENDPOINTS.estimates.list}?${queryParams}`);
  }
  
  async getEstimate(estimateId: string) {
    return this.makeRequest(GHL_ENDPOINTS.estimates.get(estimateId));
  }
}

// Helper function to create a GHL client from encrypted tokens
export async function createGHLClient(
  encryptedTokens: string,
  onTokenRefresh?: (tokens: GHLTokens) => Promise<void>,
  mcpToken?: string
): Promise<GHLClient> {
  const decryptedData = decrypt(encryptedTokens);
  const tokens: GHLTokens = JSON.parse(decryptedData);
  const client = new GHLClient(tokens, onTokenRefresh);
  
  // Try to initialize MCP if token is provided
  if (mcpToken) {
    await client.initializeMCP(mcpToken);
  }
  
  return client;
}