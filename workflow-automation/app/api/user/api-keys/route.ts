import { NextRequest, NextResponse } from 'next/server';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';

export async function GET(request: NextRequest) {
  try {
    console.log('API Keys GET request received');
    
    const auth = mockAuthServer();
    console.log('Auth result:', auth);
    
    if (!auth?.userId) {
      console.log('No user ID found, unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Fetching API keys for user:', auth.userId);
    const apiKeys = await ApiKeyManager.listUserApiKeys(auth.userId);
    
    // Return masked keys for security
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      maskedKey: ApiKeyManager.maskApiKey('sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') // Placeholder mask
    }));

    console.log('Returning masked keys:', maskedKeys.length);
    return NextResponse.json({ apiKeys: maskedKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey, keyName } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    const storedKey = await ApiKeyManager.storeApiKey({
      userId: auth.userId,
      provider,
      apiKey,
      keyName
    });

    return NextResponse.json({ 
      success: true, 
      apiKey: {
        ...storedKey,
        maskedKey: ApiKeyManager.maskApiKey(apiKey)
      }
    });
  } catch (error) {
    console.error('Error storing API key:', error);
    return NextResponse.json(
      { error: 'Failed to store API key' },
      { status: 500 }
    );
  }
}