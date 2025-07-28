import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GHL_CONFIG } from '@/lib/integrations/gohighlevel/config';
import { encrypt } from '@/lib/utils/encryption';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { parseJWT } from '@/lib/utils/jwt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations/gohighlevel?error=auth_failed', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/integrations/gohighlevel?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GHL_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: GHL_CONFIG.clientId,
        client_secret: GHL_CONFIG.clientSecret,
        redirect_uri: GHL_CONFIG.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/integrations/gohighlevel?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    console.log('GHL Token Response:', tokenData);
    
    // Decode the JWT to extract additional information
    const decodedToken = parseJWT(tokenData.access_token);
    console.log('Decoded JWT:', decodedToken);
    
    // Get user ID from our auth system
    const { userId } = mockAuthServer();

    // Prepare token data for storage
    // Try to get locationId from various sources
    const locationId = tokenData.locationId || 
                      tokenData.location_id || 
                      decodedToken?.location_id ||
                      decodedToken?.locationId ||
                      '';
    
    const companyId = tokenData.companyId || 
                     tokenData.company_id || 
                     decodedToken?.company_id ||
                     decodedToken?.companyId ||
                     '';
    
    const userType = tokenData.userType || 
                    tokenData.user_type || 
                    decodedToken?.user_type ||
                    decodedToken?.userType ||
                    '';
    
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      locationId: locationId || '', // It's OK if this is empty initially
      companyId: companyId,
      userId: tokenData.userId || tokenData.user_id || ''
    };
    
    console.log('Extracted location ID:', locationId);

    // Encrypt tokens before storing
    const encryptedTokens = encrypt(JSON.stringify(tokens));

    // Store integration data
    const integrationData = {
      user_id: userId,
      type: 'gohighlevel',
      name: 'GoHighLevel',
      config: {
        encryptedTokens,
        locationId: locationId,
        companyId: companyId,
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
        userType: userType,
        connectedAt: new Date().toISOString()
      },
      is_active: true
    };

    // Check if integration already exists
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();

    if (existing) {
      // Update existing integration
      await supabase
        .from('integrations')
        .update(integrationData)
        .eq('id', existing.id);
    } else {
      // Create new integration
      await supabase
        .from('integrations')
        .insert(integrationData);
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL('/integrations/gohighlevel?success=true', request.url)
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/integrations/gohighlevel?error=unexpected_error', request.url)
    );
  }
}