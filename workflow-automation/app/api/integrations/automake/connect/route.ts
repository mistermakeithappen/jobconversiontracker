import { NextResponse } from 'next/server';
import { GHL_CONFIG } from '@/lib/integrations/gohighlevel/config';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

export async function GET() {
  try {
    const { userId } = mockAuthServer();
    
    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      userId,
      timestamp: Date.now()
    })).toString('base64');
    
    // Build OAuth authorization URL
    const authUrl = new URL(GHL_CONFIG.authorizationUrl);
    authUrl.searchParams.append('client_id', GHL_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', GHL_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', GHL_CONFIG.scopes);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    
    return NextResponse.json({
      authUrl: authUrl.toString()
    });
    
  } catch (error) {
    console.error('Error initiating GHL OAuth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}