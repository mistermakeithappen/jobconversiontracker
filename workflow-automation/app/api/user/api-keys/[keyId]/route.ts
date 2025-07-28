import { NextRequest, NextResponse } from 'next/server';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';

export async function PUT(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, keyName, isActive } = body;

    // Validate new API key if provided
    if (apiKey) {
      // Get the provider for this key
      const existingKeys = await ApiKeyManager.listUserApiKeys(auth.userId);
      const existingKey = existingKeys.find(k => k.id === params.keyId);
      
      if (!existingKey) {
        return NextResponse.json({ error: 'API key not found' }, { status: 404 });
      }

      const isValid = await ApiKeyManager.validateApiKey(existingKey.provider, apiKey);
      if (!isValid) {
        return NextResponse.json(
          { error: `Invalid ${existingKey.provider.toUpperCase()} API key` },
          { status: 400 }
        );
      }
    }

    const updatedKey = await ApiKeyManager.updateApiKey(params.keyId, {
      apiKey,
      keyName,
      isActive
    });

    return NextResponse.json({ 
      success: true, 
      apiKey: updatedKey
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const auth = mockAuthServer();
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ApiKeyManager.deleteApiKey(params.keyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}