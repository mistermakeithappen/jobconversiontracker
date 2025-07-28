import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { pipelineId: string } }
) {
  try {
    const { userId } = mockAuthServer();
    const { pipelineId } = params;
    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get('maxResults') || '5000');
    
    // Get user's GHL integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
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
    
    try {
      console.log(`Fetching ALL opportunities for pipeline: ${pipelineId}`);
      
      // Use getAllOpportunities with pipeline filter
      const opportunitiesResponse = await ghlClient.getAllOpportunities({
        locationId: integration.config.locationId,
        pipelineId: pipelineId,
        maxResults: maxResults
      });
      
      console.log(`Pipeline ${pipelineId} opportunities response:`, {
        count: opportunitiesResponse.opportunities?.length || 0,
        requestCount: opportunitiesResponse.requestCount,
        hasError: !!opportunitiesResponse.error,
        meta: opportunitiesResponse.meta
      });
      
      return NextResponse.json({
        opportunities: opportunitiesResponse.opportunities || [],
        total: opportunitiesResponse.total || 0,
        pipelineId,
        requestCount: opportunitiesResponse.requestCount,
        maxResultsReached: opportunitiesResponse.meta?.maxResultsReached,
        totalFetched: opportunitiesResponse.meta?.totalFetched,
        isRealData: (opportunitiesResponse.opportunities || []).length > 0,
        meta: opportunitiesResponse.meta
      });
      
    } catch (apiError) {
      console.error('GHL API error for pipeline opportunities:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : 'Failed to fetch pipeline opportunities';
      const errorDetails = apiError instanceof Error ? apiError.toString() : String(apiError);
      
      return NextResponse.json({ 
        error: errorMessage,
        details: errorDetails,
        pipelineId
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error fetching pipeline opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}