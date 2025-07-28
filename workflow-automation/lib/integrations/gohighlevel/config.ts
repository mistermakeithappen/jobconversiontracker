// GoHighLevel OAuth 2.0 Configuration
export const GHL_CONFIG = {
  // OAuth endpoints
  authorizationUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
  tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
  
  // API endpoints
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  
  // OAuth credentials (these should be in env vars)
  clientId: process.env.GHL_CLIENT_ID!,
  clientSecret: process.env.GHL_CLIENT_SECRET!,
  redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/api/integrations/automake/callback',
  
  // Scopes needed for the integration
  scopes: 'contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly conversations.readonly conversations.write users.readonly',
  
  // API version (GoHighLevel uses specific date format)
  apiVersion: '2021-07-28'
};

// GHL API endpoints
export const GHL_ENDPOINTS = {
  // Contacts
  contacts: {
    list: '/contacts/',
    get: (id: string) => `/contacts/${id}`,
    create: '/contacts/',
    update: (id: string) => `/contacts/${id}`,
    delete: (id: string) => `/contacts/${id}`
  },
  
  // Opportunities
  opportunities: {
    list: '/opportunities/',
    search: '/opportunities/search',
    get: (id: string) => `/opportunities/${id}`,
    create: '/opportunities/',
    update: (id: string) => `/opportunities/${id}`
  },
  
  // Pipelines
  pipelines: {
    list: '/opportunities/pipelines',
    get: (id: string) => `/opportunities/pipelines/${id}`
  },
  
  // Calendars
  calendars: {
    list: '/calendars/',
    appointments: '/appointments/'
  },
  
  // Forms
  forms: {
    list: '/forms/',
    submissions: (formId: string) => `/forms/${formId}/submissions`
  },
  
  // Locations
  locations: {
    list: '/locations/search',
    get: (id: string) => `/locations/${id}`
  },
  
  // Users
  users: {
    me: '/users/me',
    list: '/users/',
    search: '/users/search',
    location: (locationId: string) => `/locations/${locationId}/users`
  },
  
  // Conversations & Messaging
  conversations: {
    list: '/conversations/search',
    get: (id: string) => `/conversations/${id}`,
    messages: (conversationId: string) => `/conversations/${conversationId}/messages`,
    sendMessage: (conversationId: string) => `/conversations/${conversationId}/messages`,
    createConversation: '/conversations'
  }
};