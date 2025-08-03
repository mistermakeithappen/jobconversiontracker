import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';

export async function PUT(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const { userId } = await requireAuth(request);

    const body = await request.json();
    const { apiKey, keyName, isActive } = body;

    // Validate new API key if provided
    if (apiKey) {
      // Get the provider for this key
      const existingKeys = await ApiKeyManager.listUserApiKeys(userId);
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
    const { userId } = await requireAuth(request);

    // Handle GHL PIT deletion separately
    if (params.keyId === 'ghl-pit-stored') {
      const mcpResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/ghl`, {
        method: 'DELETE',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });

      if (!mcpResponse.ok) {
        const mcpError = await mcpResponse.json();
        throw new Error(mcpError.error || 'Failed to delete GoHighLevel Private Integration Token');
      }

      return NextResponse.json({ success: true });
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