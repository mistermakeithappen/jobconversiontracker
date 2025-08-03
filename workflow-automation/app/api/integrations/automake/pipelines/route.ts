import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    
    // Get user's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // Create GHL client with token refresh callback
    const ghlClient = await createGHLClient(
      integration.config?.encryptedTokens || '',
      async (newTokens) => {
        // Update tokens in database when refreshed
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
    
    try {
      // Fetch pipelines from GHL API
      const response = await ghlClient.getPipelines();
      
      return NextResponse.json({ 
        pipelines: response.pipelines || [],
        total: response.total || 0
      });
      
    } catch (apiError: any) {
      console.error('GHL API error:', apiError);
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Authentication failed. Please reconnect GoHighLevel.' }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: apiError.message || 'Failed to fetch pipelines' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}