import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugTokenRefresh() {
  console.log('=== Debugging Token Refresh Issue ===\n');
  
  try {
    // Get the first active GHL integration
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .limit(1);
    
    if (error || !integrations || integrations.length === 0) {
      console.error('No active GHL integration found');
      return;
    }
    
    const integration = integrations[0];
    console.log('Integration found:', {
      id: integration.id,
      organization_id: integration.organization_id,
      hasConfig: !!integration.config,
      hasEncryptedTokens: !!integration.config?.encryptedTokens,
      locationId: integration.config?.locationId,
      lastTokenRefresh: integration.config?.lastTokenRefresh
    });
    
    if (!integration.config?.encryptedTokens) {
      console.error('No encrypted tokens found in integration config');
      return;
    }
    
    // Decrypt tokens
    try {
      const decryptedTokens = decrypt(integration.config.encryptedTokens);
      const tokens = JSON.parse(decryptedTokens);
      
      console.log('\nDecrypted tokens:', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        expiresAtDate: new Date(tokens.expiresAt).toISOString(),
        isExpired: Date.now() > tokens.expiresAt,
        locationId: tokens.locationId,
        companyId: tokens.companyId,
        userId: tokens.userId
      });
      
      // Check if token is expired
      if (Date.now() > tokens.expiresAt) {
        console.log('\n⚠️  Access token is expired and needs refresh');
      } else {
        const expiresIn = Math.floor((tokens.expiresAt - Date.now()) / 1000 / 60);
        console.log(`\n✓ Access token is still valid for ${expiresIn} minutes`);
      }
      
      // Try to refresh the token manually
      if (tokens.refreshToken) {
        console.log('\nAttempting manual token refresh...');
        
        const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
            client_id: process.env.GHL_CLIENT_ID!,
            client_secret: process.env.GHL_CLIENT_SECRET!,
          }),
        });
        
        console.log('Token refresh response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (response.ok) {
          try {
            const newTokens = JSON.parse(responseText);
            console.log('\n✓ Token refresh successful!');
            console.log('New token info:', {
              hasAccessToken: !!newTokens.access_token,
              hasRefreshToken: !!newTokens.refresh_token,
              expiresIn: newTokens.expires_in
            });
          } catch (e) {
            console.error('Failed to parse successful response:', e);
          }
        } else {
          console.error('\n✗ Token refresh failed');
          
          // Check if it's a specific error
          try {
            const errorData = JSON.parse(responseText);
            console.error('Error details:', errorData);
          } catch (e) {
            console.error('Raw error response:', responseText);
          }
        }
      } else {
        console.error('\n✗ No refresh token available');
      }
      
    } catch (decryptError) {
      console.error('Failed to decrypt tokens:', decryptError);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the debug script
debugTokenRefresh();