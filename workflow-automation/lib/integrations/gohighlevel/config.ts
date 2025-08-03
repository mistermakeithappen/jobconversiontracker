// GoHighLevel OAuth 2.0 Configuration
export const GHL_CONFIG = {
  // OAuth endpoints - using leadconnectorhq domain as alternative
  authorizationUrl: 'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
  tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
  
  // API endpoints
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  
  // OAuth credentials (these should be in env vars)
  clientId: process.env.GHL_CLIENT_ID!,
  clientSecret: process.env.GHL_CLIENT_SECRET!,
  redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/api/integrations/automake/callback',
  
  // Scopes needed for the integration
  // Updated to include all invoice-related scopes for estimates support
  scopes: 'contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly conversations.readonly conversations.write users.readonly products.readonly invoices.readonly invoices.write invoices/schedule.readonly invoices/schedule.write invoices/template.readonly invoices/template.write calendars.readonly calendars.write',
  
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
    list: '/calendars',
    get: (id: string) => `/calendars/${id}`,
    appointments: '/appointments/',
    groups: '/calendars/groups'
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
  },
  
  // Products & Prices
  products: {
    list: '/products/',
    search: '/products/search',
    get: (id: string) => `/products/${id}`,
    prices: (productId: string) => `/products/${productId}/prices`
  },
  
  // Payments & Invoices
  payments: {
    list: '/payments/transactions',
    get: (id: string) => `/payments/transactions/${id}`,
    orders: '/payments/orders',
    subscriptions: '/payments/subscriptions',
    invoices: '/invoices/',
    invoice: (id: string) => `/invoices/${id}`
  },
  
  // Estimates
  estimates: {
    list: '/invoices/estimate/list',
    get: (id: string) => `/invoices/estimate/${id}`,
    create: '/invoices/estimate/',
    update: (id: string) => `/invoices/estimate/${id}`,
    send: (id: string) => `/invoices/estimate/${id}/send`
  }
};