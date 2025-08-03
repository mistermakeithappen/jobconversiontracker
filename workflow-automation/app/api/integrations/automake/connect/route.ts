import { NextRequest, NextResponse } from 'next/server';
import { GHL_CONFIG } from '@/lib/integrations/gohighlevel/config';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    let userId;
    try {
      const authResult = await requireAuth(request);
      userId = authResult.userId;
    } catch (authError: any) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: authError.message || 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Log the OAuth configuration
    console.log('GHL OAuth Configuration:');
    console.log('Client ID:', GHL_CONFIG.clientId);
    console.log('Redirect URI:', GHL_CONFIG.redirectUri);
    console.log('Authorization URL:', GHL_CONFIG.authorizationUrl);
    console.log('Scopes:', GHL_CONFIG.scopes);
    
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
    
    console.log('Generated OAuth URL:', authUrl.toString());
    
    return NextResponse.json({
      authUrl: authUrl.toString()
    });
    
  } catch (error) {
    console.error('Error initiating GHL OAuth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}