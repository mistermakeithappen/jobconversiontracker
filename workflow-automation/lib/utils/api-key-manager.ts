import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface UserApiKey {
  id: string;
  userId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'notion';
  keyName?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export interface CreateApiKeyRequest {
  userId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'notion';
  apiKey: string;
  keyName?: string;
}

export class ApiKeyManager {
  
  /**
   * Store a new API key for a user
   */
  static async storeApiKey(request: CreateApiKeyRequest): Promise<UserApiKey> {
    try {
      console.log('Storing API key for user:', request.userId, 'provider:', request.provider);
      
      // Validate the API key first (allow network errors to pass through)
      const isValid = await this.validateApiKey(request.provider, request.apiKey);
      if (!isValid) {
        console.log('API key validation failed for provider:', request.provider);
        throw new Error(`Invalid ${request.provider.toUpperCase()} API key format or authentication failed`);
      }
      
      // Encrypt the API key
      console.log('Encrypting API key...');
      let encryptedKey;
      try {
        encryptedKey = encrypt(request.apiKey);
        console.log('API key encrypted successfully');
      } catch (encryptError) {
        console.error('Encryption failed:', encryptError);
        throw new Error(`Encryption failed: ${encryptError.message}`);
      }
      
      const insertData = {
        user_id: request.userId,
        provider: request.provider,
        encrypted_key: encryptedKey,
        key_name: request.keyName,
        is_active: true
      };
      
      console.log('Inserting into database:', { ...insertData, encrypted_key: '[ENCRYPTED]' });
      
      // Use service role to bypass RLS for development
      console.log('Creating Supabase client with service role...');
      console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      console.log('Client created, attempting database insert...');
      
      const { data, error } = await client
        .from('user_api_keys')
        .insert(insertData)
        .select('id, user_id, provider, key_name, created_at, updated_at, last_used_at, is_active')
        .single();

      if (error) {
        console.error('Database insert error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw new Error(`Failed to store API key: ${error.message}`);
      }

      console.log('API key stored successfully:', data.id);
      
      return {
        id: data.id,
        userId: data.user_id,
        provider: data.provider,
        keyName: data.key_name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastUsedAt: data.last_used_at,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error storing API key:', error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt an API key for a user
   */
  static async getApiKey(userId: string, provider: string, keyName?: string): Promise<string | null> {
    try {
      let query = supabase
        .from('user_api_keys')
        .select('id, encrypted_key')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('is_active', true);

      if (keyName) {
        query = query.eq('key_name', keyName);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No API key found
          return null;
        }
        throw new Error(`Failed to retrieve API key: ${error.message}`);
      }

      // Decrypt the key
      const decryptedKey = decrypt(data.encrypted_key);
      
      // Mark as used
      await this.markKeyAsUsed(data.id);
      
      return decryptedKey;
    } catch (error) {
      console.error('Error retrieving API key:', error);
      throw error;
    }
  }

  /**
   * List all API keys for a user (without decrypting them)
   */
  static async listUserApiKeys(userId: string): Promise<UserApiKey[]> {
    try {
      console.log('Listing API keys for user:', userId);
      
      // Use service role to bypass RLS for development
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      const { data, error } = await client
        .from('user_api_keys')
        .select('id, user_id, provider, key_name, created_at, updated_at, last_used_at, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error listing API keys:', error);
        throw new Error(`Failed to list API keys: ${error.message}`);
      }

      console.log('Found API keys:', data?.length || 0);
      
      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        keyName: row.key_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active
      }));
    } catch (error) {
      console.error('Error listing API keys:', error);
      throw error;
    }
  }

  /**
   * Update an API key
   */
  static async updateApiKey(keyId: string, updates: {
    apiKey?: string;
    keyName?: string;
    isActive?: boolean;
  }): Promise<UserApiKey> {
    try {
      const updateData: any = {};

      if (updates.apiKey) {
        updateData.encrypted_key = encrypt(updates.apiKey);
      }
      if (updates.keyName !== undefined) {
        updateData.key_name = updates.keyName;
      }
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const { data, error } = await supabase
        .from('user_api_keys')
        .update(updateData)
        .eq('id', keyId)
        .select('id, user_id, provider, key_name, created_at, updated_at, last_used_at, is_active')
        .single();

      if (error) {
        throw new Error(`Failed to update API key: ${error.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        provider: data.provider,
        keyName: data.key_name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastUsedAt: data.last_used_at,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error updating API key:', error);
      throw error;
    }
  }

  /**
   * Delete an API key
   */
  static async deleteApiKey(keyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) {
        throw new Error(`Failed to delete API key: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      throw error;
    }
  }

  /**
   * Mark an API key as used (updates last_used_at)
   */
  private static async markKeyAsUsed(keyId: string): Promise<void> {
    try {
      // Fallback to direct update if RPC function doesn't exist
      const { error } = await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId);
      
      if (error) {
        console.warn('Failed to mark API key as used:', error);
      }
    } catch (error) {
      // Don't throw error for this - it's not critical
      console.warn('Failed to mark API key as used:', error);
    }
  }

  /**
   * Validate an OpenAI API key
   */
  static async validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      // Basic format validation
      if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
        console.log('OpenAI key format validation failed');
        return false;
      }
      
      console.log('Attempting OpenAI API validation...');
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Validation timeout')), 10000)
      );
      
      const fetchPromise = fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      const isValid = response.ok;
      console.log('OpenAI validation result:', isValid, response.status);
      
      if (!isValid) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.log('OpenAI validation error:', errorText);
      }
      
      return isValid;
    } catch (error) {
      console.error('Error validating OpenAI key:', error);
      // If validation fails due to network issues, allow the key to be stored
      // This prevents network issues from blocking key storage
      console.log('Network error during validation - allowing key storage');
      return true;
    }
  }

  /**
   * Validate a Notion API key
   */
  static async validateNotionKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating Notion key:', error);
      return false;
    }
  }

  /**
   * Validate an API key based on provider
   */
  static async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
    switch (provider) {
      case 'openai':
        return this.validateOpenAIKey(apiKey);
      case 'notion':
        return this.validateNotionKey(apiKey);
      case 'anthropic':
      case 'google':
      case 'azure':
        // For now, just check format - add proper validation later
        return apiKey.length > 10;
      default:
        return false;
    }
  }

  /**
   * Get a masked version of an API key for display
   */
  static maskApiKey(key: string): string {
    if (key.length <= 8) {
      return '*'.repeat(key.length);
    }
    return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
  }
}

export default ApiKeyManager;