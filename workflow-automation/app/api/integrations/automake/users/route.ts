import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GHLUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  isActive?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    
    // Get user's GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('No active GoHighLevel integration found');
      return NextResponse.json({ 
        users: [],
        isRealData: false,
        error: 'GoHighLevel integration not found or not active'
      }, { status: 404 });
    }

    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ 
        users: [],
        isRealData: false,
        error: 'GoHighLevel integration missing required configuration'
      }, { status: 400 });
    }

    // Create GHL client with token refresh callback
    const ghlClient = await createGHLClient(
      integration.config.encryptedTokens,
      async (newTokens) => {
        const encryptedTokens = encrypt(JSON.stringify(newTokens));
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              encryptedTokens,
              lastTokenRefresh: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
      }
    );

    console.log('Fetching users from GoHighLevel API...');

    try {
      // Try to get users from the location
      const locationId = integration.config.locationId;
      if (!locationId) {
        return NextResponse.json({ 
          users: [],
          isRealData: false,
          error: 'No location ID available. Please reconnect GoHighLevel.'
        }, { status: 400 });
      }

      // Check if we have the users.readonly scope
      const hasUsersScope = integration.config.scope?.includes('users.readonly');
      if (!hasUsersScope) {
        return NextResponse.json({
          users: [],
          isRealData: false,
          error: 'Users endpoint requires users.readonly scope. Please reconnect GoHighLevel to grant additional permissions.',
          currentScope: integration.config.scope,
          requiredScope: 'users.readonly'
        });
      }

      console.log('We have users.readonly scope, fetching users...');

      // Use the working approach: fetch users with pagination
      let allUsers: GHLUser[] = [];
      let hasMore = true;
      let startAfter = '';
      let requestCount = 0;
      const maxRequests = 10;

      while (hasMore && requestCount < maxRequests) {
        requestCount++;
        
        console.log(`Making API request ${requestCount} for users (startAfter: ${startAfter || 'none'})`);
        
        const response = await ghlClient.getLocationUsers({
          limit: 100,
          startAfter: startAfter || undefined,
          locationId
        });
        
        console.log(`Received response for request ${requestCount}:`, {
          hasUsers: !!response.users,
          userCount: response.users?.length || 0,
          hasMeta: !!response.meta
        });

        if (response.users && Array.isArray(response.users)) {
          const processedUsers = response.users.map((user: any) => ({
            id: user.id,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.roles?.role || 'User',
            isActive: !user.deleted
          }));

          allUsers = [...allUsers, ...processedUsers];
        }

        // Check pagination
        hasMore = response.meta?.hasMore === true;
        if (hasMore && response.meta?.startAfter) {
          startAfter = response.meta.startAfter;
        } else {
          hasMore = false;
        }

        if (allUsers.length >= 1000) {
          console.log('Reached maximum user limit (1000), stopping pagination');
          break;
        }
      }

      console.log(`Successfully fetched ${allUsers.length} users from GoHighLevel`);

      return NextResponse.json({
        users: allUsers,
        isRealData: true,
        requestCount,
        totalFetched: allUsers.length,
        maxResultsReached: allUsers.length >= 1000
      });

    } catch (apiError: any) {
      console.error('GHL Users API error:', apiError);
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ 
          users: [],
          isRealData: false,
          error: 'Authentication failed. Please reconnect GoHighLevel.' 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        users: [],
        isRealData: false,
        error: `GoHighLevel API error: ${apiError.message || 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error fetching GoHighLevel users:', error);
    return NextResponse.json({ 
      users: [],
      isRealData: false,
      error: 'Failed to fetch users from GoHighLevel' 
    }, { status: 500 });
  }
}