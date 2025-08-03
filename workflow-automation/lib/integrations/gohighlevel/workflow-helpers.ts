// This file contains server-side only helper functions for GoHighLevel workflow operations
// It should ONLY be imported in API routes, never in client components

import { createGHLClient } from './client';
import { getServiceSupabase } from '@/lib/supabase/client';

// Cache for frequently accessed data
const cache = {
  calendars: new Map<string, { data: any; timestamp: number }>(),
  customFields: new Map<string, { data: any; timestamp: number }>(),
  tags: new Map<string, { data: any; timestamp: number }>(),
  metadata: new Map<string, { data: any; timestamp: number }>(),
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getGHLClientForUser(userId: string) {
  const supabase = getServiceSupabase();
  
  console.log('Getting GHL client for user:', userId);
  
  // First get the user's organization
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
    
  if (!orgMember) {
    throw new Error('User is not part of any organization');
  }
  
  // Get organization's GHL integration with config
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('organization_id', orgMember.organization_id)
    .eq('type', 'gohighlevel')
    .eq('is_active', true)
    .single();
    
  if (error) {
    console.error('Error fetching GHL integration:', error);
    throw new Error(`GoHighLevel integration not found: ${error.message}`);
  }
    
  if (!integration) {
    throw new Error('GoHighLevel integration not found for organization');
  }
  
  if (!integration.config?.encryptedTokens) {
    throw new Error('GoHighLevel tokens not found - please reconnect your GoHighLevel account');
  }
  
  // Extract metadata from config
  const metadata = {
    location_id: integration.config.locationId || '',
    company_id: integration.config.companyId || '',
    user_type: integration.config.userType || '',
    scope: integration.config.scope || '',
    token_type: integration.config.tokenType || ''
  };
  
  // Log the metadata for debugging
  console.log('Integration metadata:', metadata);
  
  // Get MCP integration if available
  let mcpApiKey: string | undefined;
  const { data: mcpIntegration } = await supabase
    .from('mcp_integrations')
    .select('private_integration_token')
    .eq('integration_id', integration.id)
    .eq('is_active', true)
    .single();
  
  if (mcpIntegration?.private_integration_token) {
    mcpApiKey = mcpIntegration.private_integration_token;
  }
  
  const client = await createGHLClient(
    integration.config.encryptedTokens,
    undefined,
    mcpApiKey
  );
  
  // Store metadata in cache for quick access
  cache.metadata.set(userId, {
    data: metadata,
    timestamp: Date.now()
  });
  
  return { client, metadata };
}

export async function fetchCalendars(userId: string, locationId?: string) {
  const cacheKey = `${userId}-${locationId}`;
  const cached = cache.calendars.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const { client, metadata } = await getGHLClientForUser(userId);
    
    // Get the location ID from metadata or parameter
    const actualLocationId = locationId || metadata?.location_id || client.getLocationId();
    
    console.log('Fetching calendars for location:', actualLocationId);
    console.log('Metadata location_id:', metadata?.location_id);
    
    if (!actualLocationId) {
      console.error('No location ID available for calendar fetch');
      console.error('Metadata:', metadata);
      return [];
    }
    
    // Use v2 API to get calendars
    try {
      const response = await client.makeRequest(`/calendars?locationId=${actualLocationId}`, {
        method: 'GET',
        headers: {
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });
      
      console.log('Calendar v2 API response:', response);
      
      let calendars: any[] = [];
      
      // Handle different response formats
      if (response?.calendars && Array.isArray(response.calendars)) {
        calendars = response.calendars;
      } else if (Array.isArray(response)) {
        calendars = response;
      } else if (response?.data && Array.isArray(response.data)) {
        calendars = response.data;
      }
      
      if (calendars.length > 0) {
        const processedCalendars = calendars
          .filter((cal: any) => cal.isActive !== false && !cal.isDeleted)
          .map((cal: any) => ({
            id: cal.id || cal._id,
            name: cal.name || 'Unnamed Calendar',
            description: cal.description || '',
            slug: cal.slug || '',
            widgetType: cal.widgetType || 'default',
            calendarType: cal.calendarType || 'appointment',
            isActive: cal.isActive !== false,
            locationId: cal.locationId || actualLocationId
          }));
        
        console.log('Processed calendars:', processedCalendars);
        
        cache.calendars.set(cacheKey, {
          data: processedCalendars,
          timestamp: Date.now()
        });
        
        return processedCalendars;
      }
    } catch (restError) {
      console.error('Calendar v2 API failed:', restError);
    }
    
    // If direct calendar fetch fails, return empty array
    // Don't try to infer from events as it's unreliable
    console.log('No calendars found or error occurred');
    
    cache.calendars.set(cacheKey, {
      data: [],
      timestamp: Date.now()
    });
    
    return [];
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return [];
  }
}

export async function fetchCustomFields(userId: string, locationId?: string) {
  const cacheKey = `${userId}-${locationId}`;
  const cached = cache.customFields.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const { client, metadata } = await getGHLClientForUser(userId);
    const actualLocationId = locationId || metadata?.location_id;
    const customFields = await client.getCustomFields(actualLocationId);
    
    const fields = customFields?.customFields || [];
    
    cache.customFields.set(cacheKey, {
      data: fields,
      timestamp: Date.now()
    });
    
    return fields;
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return [];
  }
}

export async function fetchExistingTags(userId: string, locationId?: string) {
  const cacheKey = `${userId}-${locationId}`;
  const cached = cache.tags.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const { client } = await getGHLClientForUser(userId);
    
    // Fetch some contacts to extract unique tags
    const contacts = await client.getContacts({ limit: 100 });
    
    const tagSet = new Set<string>();
    if (contacts?.contacts) {
      contacts.contacts.forEach((contact: any) => {
        if (contact.tags && Array.isArray(contact.tags)) {
          contact.tags.forEach((tag: string) => tagSet.add(tag));
        }
      });
    }
    
    const tags = Array.from(tagSet).sort();
    
    cache.tags.set(cacheKey, {
      data: tags,
      timestamp: Date.now()
    });
    
    return tags;
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

export async function bookAppointment(
  userId: string,
  calendarId: string,
  contactId: string,
  appointmentData: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  }
) {
  try {
    const { client } = await getGHLClientForUser(userId);
    
    // Note: The official 21 tools don't include appointment creation
    // This would need to be implemented via REST API
    const appointment = await client.createAppointment({
      calendarId,
      contactId,
      ...appointmentData
    });
    
    return appointment;
  } catch (error) {
    console.error('Error booking appointment:', error);
    throw error;
  }
}

export async function addTagsToContact(
  userId: string,
  contactId: string,
  tags: string[]
) {
  try {
    const { client } = await getGHLClientForUser(userId);
    const result = await client.addTags(contactId, tags);
    return result;
  } catch (error) {
    console.error('Error adding tags:', error);
    throw error;
  }
}

export async function removeTagsFromContact(
  userId: string,
  contactId: string,
  tags: string[]
) {
  try {
    const { client } = await getGHLClientForUser(userId);
    const result = await client.removeTags(contactId, tags);
    return result;
  } catch (error) {
    console.error('Error removing tags:', error);
    throw error;
  }
}

export async function updateCustomField(
  userId: string,
  contactId: string,
  fieldId: string,
  value: any
) {
  try {
    const { client } = await getGHLClientForUser(userId);
    
    // Update contact with custom field value
    const result = await client.updateContact(contactId, {
      customField: {
        [fieldId]: value
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error updating custom field:', error);
    throw error;
  }
}

export async function createOpportunity(
  userId: string,
  contactId: string,
  pipelineId: string,
  stageId: string,
  opportunityData: {
    name: string;
    value?: number;
    status?: string;
  }
) {
  try {
    const { client } = await getGHLClientForUser(userId);
    
    const opportunity = await client.createOpportunity({
      contactId,
      pipelineId,
      pipelineStageId: stageId,
      ...opportunityData
    });
    
    return opportunity;
  } catch (error) {
    console.error('Error creating opportunity:', error);
    throw error;
  }
}

// Clear cache function
export function clearGHLCache() {
  cache.calendars.clear();
  cache.customFields.clear();
  cache.tags.clear();
}