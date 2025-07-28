// Integration Registry - Central place to track all integrations and their API endpoints

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description: string;
    example?: any;
  }>;
  responses?: Array<{
    status: number;
    description: string;
    example?: any;
  }>;
  authentication?: string;
  rateLimit?: string;
  version?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'CRM' | 'AI' | 'Communication' | 'Database' | 'Storage' | 'Analytics' | 'Other';
  status: 'active' | 'beta' | 'deprecated' | 'planned';
  documentation?: string;
  website?: string;
  authType?: 'oauth2' | 'api_key' | 'basic' | 'none';
  endpoints: ApiEndpoint[];
  webhooks?: Array<{
    event: string;
    description: string;
    payload?: any;
  }>;
  sdks?: Array<{
    language: string;
    package: string;
    documentation?: string;
  }>;
}

export const INTEGRATION_REGISTRY: Integration[] = [
  {
    id: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'CRM and marketing automation platform integration for contacts, opportunities, and team management',
    category: 'CRM',
    status: 'active',
    website: 'https://gohighlevel.com',
    authType: 'oauth2',
    endpoints: [
      {
        method: 'GET',
        path: '/api/integrations/automake/status',
        description: 'Check GoHighLevel integration connection status',
        responses: [
          {
            status: 200,
            description: 'Connection status retrieved successfully',
            example: {
              connected: true,
              integrationId: 'uuid-here',
              integration: {
                provider: 'gohighlevel',
                is_active: true,
                config: {
                  locationId: 'location-id'
                }
              }
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/api/integrations/automake/connect',
        description: 'Initiate OAuth2 connection flow with GoHighLevel',
        responses: [
          {
            status: 200,
            description: 'OAuth URL generated successfully',
            example: {
              authUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation?...'
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/integrations/automake/disconnect',
        description: 'Disconnect GoHighLevel integration',
        responses: [
          {
            status: 200,
            description: 'Integration disconnected successfully'
          }
        ]
      },
      {
        method: 'GET',
        path: '/api/integrations/automake/contacts',
        description: 'Fetch contacts from GoHighLevel',
        parameters: [
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of contacts to retrieve (default: 100)',
            example: 100
          },
          {
            name: 'startAfter',
            type: 'string',
            required: false,
            description: 'Pagination cursor for next page',
            example: 'contact-id-here'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Contacts retrieved successfully',
            example: {
              contacts: [
                {
                  id: 'contact-id',
                  name: 'John Doe',
                  email: 'john@example.com',
                  phone: '+1234567890',
                  tags: ['customer', 'vip'],
                  dateAdded: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        ],
        authentication: 'OAuth2 Bearer Token'
      },
      {
        method: 'GET',
        path: '/api/integrations/automake/opportunities',
        description: 'Fetch opportunities/deals from GoHighLevel',
        parameters: [
          {
            name: 'pipelineId',
            type: 'string',
            required: false,
            description: 'Filter by specific pipeline ID',
            example: 'pipeline-uuid'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Opportunities retrieved successfully',
            example: {
              opportunities: [
                {
                  id: 'opp-id',
                  name: 'Deal Name',
                  contactName: 'John Doe',
                  pipelineName: 'Sales Pipeline',
                  stageName: 'Proposal',
                  status: 'open',
                  monetaryValue: 5000,
                  totalExpenses: 500,
                  netProfit: 4500,
                  profitMargin: 90
                }
              ],
              pipelines: [],
              isRealData: true,
              requestCount: 1,
              totalFetched: 25
            }
          }
        ],
        authentication: 'OAuth2 Bearer Token'
      },
      {
        method: 'GET',
        path: '/api/integrations/automake/users',
        description: 'Fetch team members/users from GoHighLevel',
        responses: [
          {
            status: 200,
            description: 'Users retrieved successfully',
            example: {
              users: [
                {
                  id: 'user-id',
                  name: 'Jane Smith',
                  email: 'jane@company.com',
                  phone: '+1234567890',
                  firstName: 'Jane',
                  lastName: 'Smith',
                  role: 'Admin',
                  isActive: true
                }
              ],
              isRealData: true,
              requestCount: 1,
              totalFetched: 10
            }
          }
        ],
        authentication: 'OAuth2 Bearer Token'
      },
      {
        method: 'POST',
        path: '/api/integrations/automake/sync',
        description: 'Trigger manual sync of GoHighLevel data',
        responses: [
          {
            status: 200,
            description: 'Sync completed successfully'
          }
        ],
        authentication: 'OAuth2 Bearer Token'
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI-powered text generation, image analysis, and receipt processing using GPT models',
    category: 'AI',
    status: 'active',
    website: 'https://openai.com',
    authType: 'api_key',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ai/process-receipt',
        description: 'Process receipt image using GPT-4 Vision to extract structured data',
        parameters: [
          {
            name: 'image',
            type: 'string',
            required: true,
            description: 'Base64 encoded image data or image URL',
            example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
          },
          {
            name: 'opportunityId',
            type: 'string',
            required: false,
            description: 'Associate receipt with specific opportunity',
            example: 'opp-uuid-here'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Receipt processed successfully',
            example: {
              vendor: 'Home Depot',
              amount: 156.78,
              date: '2024-01-15',
              description: 'Building supplies',
              category: 'Materials',
              items: [
                {
                  description: '2x4 Lumber',
                  quantity: 10,
                  unitPrice: 5.99,
                  total: 59.90
                }
              ],
              confidence: 0.95
            }
          }
        ],
        authentication: 'API Key required in user settings'
      }
    ]
  },
  {
    id: 'payments',
    name: 'Payment Structures',
    description: 'Employee payment and payroll management system',
    category: 'Analytics',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/user-payment-assignments',
        description: 'Get all active payment structure assignments',
        responses: [
          {
            status: 200,
            description: 'Payment assignments retrieved successfully',
            example: {
              assignments: [
                {
                  id: 'assignment-uuid',
                  user_id: 'ghl-user-id',
                  ghl_user_name: 'John Doe',
                  ghl_user_email: 'john@company.com',
                  payment_type: 'hourly',
                  hourly_rate: 25.00,
                  overtime_rate: 37.50,
                  effective_date: '2024-01-01',
                  is_active: true,
                  created_at: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/user-payment-assignments',
        description: 'Create new payment structure assignment for a user',
        parameters: [
          {
            name: 'ghl_user_id',
            type: 'string',
            required: true,
            description: 'GoHighLevel user ID',
            example: 'ghl-user-uuid'
          },
          {
            name: 'ghl_user_name',
            type: 'string',
            required: true,
            description: 'Full name of the user',
            example: 'John Doe'
          },
          {
            name: 'payment_type',
            type: 'string',
            required: true,
            description: 'Type of payment structure',
            example: 'hourly'
          },
          {
            name: 'hourly_rate',
            type: 'number',
            required: false,
            description: 'Hourly rate (required for hourly payment type)',
            example: 25.00
          },
          {
            name: 'effective_date',
            type: 'string',
            required: true,
            description: 'Date when payment structure becomes effective (YYYY-MM-DD)',
            example: '2024-01-01'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Payment structure assigned successfully',
            example: {
              assignment: {
                id: 'new-assignment-uuid',
                user_id: 'ghl-user-id',
                payment_type: 'hourly',
                hourly_rate: 25.00,
                is_active: true
              },
              message: 'Payment structure assigned successfully'
            }
          }
        ]
      },
      {
        method: 'PUT',
        path: '/api/user-payment-assignments',
        description: 'Update existing payment structure assignment',
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Assignment ID to update',
            example: 'assignment-uuid'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Payment structure updated successfully'
          }
        ]
      },
      {
        method: 'DELETE',
        path: '/api/user-payment-assignments',
        description: 'Remove payment structure assignment (soft delete)',
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Assignment ID to remove',
            example: 'assignment-uuid'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Payment structure removed successfully'
          }
        ]
      }
    ]
  },
  {
    id: 'company-cards',
    name: 'Company Credit Cards',
    description: 'Manage company credit cards for automatic expense reimbursement tracking',
    category: 'Analytics',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/company-credit-cards',
        description: 'Get all active company credit cards',
        responses: [
          {
            status: 200,
            description: 'Credit cards retrieved successfully',
            example: {
              cards: [
                {
                  id: 'card-uuid',
                  cardName: 'Company Amex',
                  lastFourDigits: '1234',
                  cardType: 'American Express',
                  isReimbursable: true,
                  notes: 'Main company card for business expenses',
                  isActive: true,
                  createdAt: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/company-credit-cards',
        description: 'Add new company credit card',
        parameters: [
          {
            name: 'cardName',
            type: 'string',
            required: true,
            description: 'Friendly name for the card',
            example: 'Company Visa'
          },
          {
            name: 'lastFourDigits',
            type: 'string',
            required: true,
            description: 'Last 4 digits of the card (exactly 4 digits)',
            example: '1234'
          },
          {
            name: 'cardType',
            type: 'string',
            required: false,
            description: 'Type of credit card',
            example: 'Visa'
          },
          {
            name: 'isReimbursable',
            type: 'boolean',
            required: false,
            description: 'Whether expenses on this card are reimbursable',
            example: true
          }
        ],
        responses: [
          {
            status: 201,
            description: 'Credit card added successfully'
          }
        ]
      },
      {
        method: 'PUT',
        path: '/api/company-credit-cards',
        description: 'Update existing company credit card',
        responses: [
          {
            status: 200,
            description: 'Credit card updated successfully'
          }
        ]
      },
      {
        method: 'DELETE',
        path: '/api/company-credit-cards',
        description: 'Remove company credit card (soft delete)',
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'Card ID to remove',
            example: 'card-uuid'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Credit card removed successfully'
          }
        ]
      }
    ]
  },
  {
    id: 'receipts',
    name: 'Receipt Management',
    description: 'Process and manage receipts with AI extraction and reimbursement tracking',
    category: 'Analytics',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/receipts',
        description: 'Get receipts with optional filtering',
        parameters: [
          {
            name: 'opportunityId',
            type: 'string',
            required: false,
            description: 'Filter by opportunity ID',
            example: 'opp-uuid'
          },
          {
            name: 'reimbursable',
            type: 'boolean',
            required: false,
            description: 'Filter by reimbursable status',
            example: true
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Receipts retrieved successfully',
            example: {
              receipts: [
                {
                  id: 'receipt-uuid',
                  opportunityId: 'opp-uuid',
                  vendor: 'Home Depot',
                  amount: 156.78,
                  date: '2024-01-15',
                  submittedBy: 'John Doe',
                  reimbursable: true,
                  paymentMethod: 'credit_card',
                  lastFourDigits: '1234',
                  createdAt: '2024-01-15T10:30:00Z'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/receipts',
        description: 'Create new receipt entry',
        parameters: [
          {
            name: 'opportunityId',
            type: 'string',
            required: true,
            description: 'Associated opportunity ID',
            example: 'opp-uuid'
          },
          {
            name: 'vendor',
            type: 'string',
            required: true,
            description: 'Vendor/merchant name',
            example: 'Home Depot'
          },
          {
            name: 'amount',
            type: 'number',
            required: true,
            description: 'Receipt amount',
            example: 156.78
          },
          {
            name: 'submittedBy',
            type: 'string',
            required: true,
            description: 'Name of person submitting receipt',
            example: 'John Doe'
          },
          {
            name: 'paymentMethod',
            type: 'string',
            required: false,
            description: 'Payment method used',
            example: 'credit_card'
          },
          {
            name: 'lastFourDigits',
            type: 'string',
            required: false,
            description: 'Last 4 digits of credit card (for auto-reimbursable determination)',
            example: '1234'
          }
        ],
        responses: [
          {
            status: 201,
            description: 'Receipt created successfully'
          }
        ]
      }
    ]
  },
  {
    id: 'workflows',
    name: 'Workflow Management',
    description: 'Create, execute, and monitor automation workflows',
    category: 'Other',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/workflows/list',
        description: 'Get all workflows for the authenticated user',
        responses: [
          {
            status: 200,
            description: 'Workflows retrieved successfully',
            example: {
              workflows: [
                {
                  id: 'workflow-uuid',
                  name: 'Receipt Processing',
                  description: 'Automated receipt processing workflow',
                  isActive: true,
                  executionCount: 42,
                  lastExecutedAt: '2024-01-15T10:30:00Z',
                  createdAt: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/api/workflows/executions',
        description: 'Get workflow execution history',
        parameters: [
          {
            name: 'workflowId',
            type: 'string',
            required: false,
            description: 'Filter by specific workflow ID',
            example: 'workflow-uuid'
          },
          {
            name: 'status',
            type: 'string',
            required: false,
            description: 'Filter by execution status',
            example: 'completed'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Executions retrieved successfully',
            example: {
              executions: [
                {
                  id: 'execution-uuid',
                  workflowId: 'workflow-uuid',
                  status: 'completed',
                  startedAt: '2024-01-15T10:30:00Z',
                  completedAt: '2024-01-15T10:31:00Z',
                  inputData: {},
                  outputData: {},
                  error: null
                }
              ]
            }
          }
        ]
      }
    ]
  },
  {
    id: 'api-keys',
    name: 'API Key Management',
    description: 'Manage API keys for various AI and service providers',
    category: 'Other',
    status: 'active',
    endpoints: [
      {
        method: 'GET',
        path: '/api/user/api-keys',
        description: 'Get all API keys for the authenticated user',
        responses: [
          {
            status: 200,
            description: 'API keys retrieved successfully',
            example: {
              apiKeys: [
                {
                  id: 'key-uuid',
                  provider: 'openai',
                  keyName: 'Production Key',
                  maskedKey: 'sk-proj-****...****1234',
                  isActive: true,
                  createdAt: '2024-01-01T00:00:00Z',
                  lastUsedAt: '2024-01-15T10:30:00Z'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/user/api-keys',
        description: 'Add new API key',
        parameters: [
          {
            name: 'provider',
            type: 'string',
            required: true,
            description: 'API provider name',
            example: 'openai'
          },
          {
            name: 'apiKey',
            type: 'string',
            required: true,
            description: 'The actual API key (will be encrypted)',
            example: 'sk-proj-abcd1234...'
          },
          {
            name: 'keyName',
            type: 'string',
            required: false,
            description: 'Friendly name for the key',
            example: 'Production Key'
          }
        ],
        responses: [
          {
            status: 201,
            description: 'API key added successfully'
          }
        ]
      },
      {
        method: 'DELETE',
        path: '/api/user/api-keys/[id]',
        description: 'Delete API key',
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'API key ID to delete',
            example: 'key-uuid'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'API key deleted successfully'
          }
        ]
      }
    ]
  }
];

// Helper functions for the registry
export function getIntegrationById(id: string): Integration | undefined {
  return INTEGRATION_REGISTRY.find(integration => integration.id === id);
}

export function getIntegrationsByCategory(category: Integration['category']): Integration[] {
  return INTEGRATION_REGISTRY.filter(integration => integration.category === category);
}

export function getActiveIntegrations(): Integration[] {
  return INTEGRATION_REGISTRY.filter(integration => integration.status === 'active');
}

export function getAllEndpoints(): Array<ApiEndpoint & { integrationId: string; integrationName: string }> {
  return INTEGRATION_REGISTRY.flatMap(integration => 
    integration.endpoints.map(endpoint => ({
      ...endpoint,
      integrationId: integration.id,
      integrationName: integration.name
    }))
  );
}

export function searchEndpoints(query: string): Array<ApiEndpoint & { integrationId: string; integrationName: string }> {
  const allEndpoints = getAllEndpoints();
  const lowerQuery = query.toLowerCase();
  
  return allEndpoints.filter(endpoint => 
    endpoint.path.toLowerCase().includes(lowerQuery) ||
    endpoint.description.toLowerCase().includes(lowerQuery) ||
    endpoint.integrationName.toLowerCase().includes(lowerQuery)
  );
}