import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GHL_CONFIG } from '@/lib/integrations/gohighlevel/config';
import { encrypt } from '@/lib/utils/encryption';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { parseJWT } from '@/lib/utils/jwt';

// Use getServiceSupabase for consistency
const supabase = getServiceSupabase();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL('/ghl?error=auth_failed', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/ghl?error=no_code', request.url)
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
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText
      });
      
      // Try to parse as JSON if possible
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return NextResponse.redirect(
        new URL(`/ghl?error=token_exchange_failed&status=${tokenResponse.status}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Try to decode the JWT to extract additional information
    let decodedToken = null;
    if (tokenData.access_token) {
      // Check if it's a JWT (has 3 parts separated by dots)
      if (tokenData.access_token.split('.').length === 3) {
        decodedToken = parseJWT(tokenData.access_token);
      }
    }
    
    // Decode state to get user ID (since this is a callback from external service)
    let userId: string;
    try {
      if (state) {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decodedState.userId;
      } else {
        throw new Error('No state parameter in callback');
      }
    } catch (error) {
      console.error('Failed to decode state:', error);
      return NextResponse.redirect(
        new URL('/ghl?error=invalid_state', request.url)
      );
    }
    
    // Get organization for the user
    console.log('Looking up organization for user:', userId);
    let organization = await getUserOrganization(userId);
    
    if (!organization) {
      console.error('No organization found for user:', userId);
      
      // For now, let's create a default organization for the user
      // In production, this should be handled properly during user signup
      const supabase = getServiceSupabase();
      
      // Check if user exists
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();
      
      if (!user) {
        console.error('User not found in database:', userId);
        return NextResponse.redirect(
          new URL('/ghl?error=user_not_found', request.url)
        );
      }
      
      // Create organization for the user
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: `${user.email}'s Organization`,
          slug: `org-${userId.substring(0, 8)}`,
          subscription_status: 'active',
          subscription_plan: 'free'
        })
        .select()
        .single();
      
      if (orgError || !newOrg) {
        console.error('Failed to create organization:', orgError);
        return NextResponse.redirect(
          new URL('/ghl?error=org_creation_failed', request.url)
        );
      }
      
      // Add user as owner of the organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: userId,
          role: 'owner',
          permissions: []
        });
      
      if (memberError) {
        console.error('Failed to add user to organization:', memberError);
        return NextResponse.redirect(
          new URL('/ghl?error=member_creation_failed', request.url)
        );
      }
      
      // Use the newly created organization
      organization = {
        organizationId: newOrg.id,
        role: 'owner',
        permissions: []
      };
    }

    // Prepare token data for storage
    // Try to get locationId from various sources
    const locationId = tokenData.locationId || 
                      tokenData.location_id || 
                      (decodedToken && decodedToken.location_id) ||
                      (decodedToken && decodedToken.locationId) ||
                      '';
    
    const companyId = tokenData.companyId || 
                     tokenData.company_id || 
                     (decodedToken && decodedToken.company_id) ||
                     (decodedToken && decodedToken.companyId) ||
                     '';
    
    const userType = tokenData.userType || 
                    tokenData.user_type || 
                    (decodedToken && decodedToken.user_type) ||
                    (decodedToken && decodedToken.userType) ||
                    '';
    
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      locationId: locationId || '', // It's OK if this is empty initially
      companyId: companyId,
      userId: tokenData.userId || tokenData.user_id || ''
    };
    

    // Encrypt tokens before storing
    const encryptedTokens = encrypt(JSON.stringify(tokens));

    // Store integration data with all important fields
    const integrationData = {
      organization_id: organization.organizationId,
      type: 'gohighlevel', // Using type field
      name: 'GoHighLevel',
      created_by: userId,
      config: {
        // Token data
        encryptedTokens,
        
        // Core IDs
        locationId: locationId || '',
        companyId: companyId || '',
        userId: tokenData.userId || tokenData.user_id || (decodedToken && decodedToken.userId) || '',
        
        // User information
        userType: userType || '',
        email: (decodedToken && decodedToken.email) || '',
        
        // OAuth details
        scope: tokenData.scope || '',
        tokenType: tokenData.token_type || 'Bearer',
        
        // Additional metadata from JWT
        iss: (decodedToken && decodedToken.iss) || '', // Issuer
        aud: (decodedToken && decodedToken.aud) || '', // Audience
        sub: (decodedToken && decodedToken.sub) || '', // Subject (often user ID)
        
        // Timestamps
        connectedAt: new Date().toISOString(),
        lastTokenRefresh: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        
        // Integration metadata
        integrationId: (decodedToken && decodedToken.integrationId) || '',
        marketplaceAppId: (decodedToken && decodedToken.marketplaceAppId) || '',
        
        // Permissions and features
        permissions: (decodedToken && decodedToken.permissions) || [],
        features: (decodedToken && decodedToken.features) || [],
        
        // Location details (will be fetched later)
        locationName: '',
        locationTimezone: '',
        locationAddress: {},
        
        // Company details (will be fetched later)
        companyName: '',
        
        // User details (will be fetched later)
        userName: '',
        userRole: ''
      },
      is_active: true
    };

    // Check if integration already exists for this organization
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .single();

    let integrationId: string;
    
    if (existing) {
      // Update existing integration
      // Clear any reconnection flags from the config
      const updatedConfig = {
        ...integrationData.config,
        needsReconnection: false,
        reconnectionReason: null,
        lastRefreshError: null
      };
      
      const { error } = await supabase
        .from('integrations')
        .update({
          config: updatedConfig,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .eq('organization_id', organization.organizationId);
        
      if (error) {
        console.error('Error updating integration:', error);
        throw error;
      }
      integrationId = existing.id;
    } else {
      // Create new integration
      const { data: newIntegration, error } = await supabase
        .from('integrations')
        .insert({
          ...integrationData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Error creating integration:', error);
        throw error;
      }
      integrationId = newIntegration?.id;
    }

    // Automatically analyze pipeline stages and fetch additional details after successful connection
    if (integrationId) {
      try {
        // If we don't have a locationId, try to get it from the locations endpoint
        let finalLocationId = locationId;
        
        if (!finalLocationId) {
          try {
            // Create a temporary client to fetch locations
            const { decrypt } = await import('@/lib/utils/encryption');
            const tempTokens = JSON.parse(decrypt(encryptedTokens));
            
            const locationsResponse = await fetch('https://services.leadconnectorhq.com/locations/search', {
              headers: {
                'Authorization': `Bearer ${tempTokens.accessToken}`,
                'Version': '2021-07-28',
                'Accept': 'application/json'
              }
            });
            
            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json();
              
              if (locationsData.locations && locationsData.locations.length > 0) {
                finalLocationId = locationsData.locations[0].id;
                
                // Update the integration with the location ID
                await supabase
                  .from('integrations')
                  .update({
                    config: {
                      ...integrationData.config,
                      locationId: finalLocationId
                    }
                  })
                  .eq('id', integrationId);
              }
            }
          } catch (locError) {
            console.error('Error fetching locations:', locError);
          }
        }
        
        // Trigger pipeline analysis in the background
        fetch(new URL('/api/pipelines/analyze-on-connect', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            integrationId,
            userId 
          })
        }).catch(error => {
          console.error('Background pipeline analysis failed:', error);
        });
        
        // Fetch additional details in the background
        const baseUrl = request.url.split('/api/')[0];
        const fetchDetailsUrl = `${baseUrl}/api/integrations/automake/fetch-details`;
        
        fetch(fetchDetailsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            integrationId,
            userId,
            locationId: finalLocationId,
            companyId
          })
        }).catch(error => {
          console.error('Background detail fetch failed:', error);
        });
      } catch (error) {
        console.error('Error initiating background tasks:', error);
        // Don't fail the OAuth callback for this
      }
    }

    // Redirect back to GHL page with success
    return NextResponse.redirect(
      new URL('/ghl?success=true', request.url)
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    console.error('Error details:', error instanceof Error ? error.stack : 'Unknown error');
    
    // Try to provide more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorParam = encodeURIComponent(errorMessage.substring(0, 100)); // Limit error message length
    
    return NextResponse.redirect(
      new URL(`/ghl?error=unexpected_error&details=${errorParam}`, request.url)
    );
  }
}