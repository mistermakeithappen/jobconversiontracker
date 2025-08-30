import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireAuth(request);
    const supabase = getServiceSupabase();

    // Get GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'GoHighLevel integration not found' },
        { status: 404 }
      );
    }

    // Create GHL client with token refresh callback
    const ghlClient = await createGHLClient(
      integration.config?.encryptedTokens || '',
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

    // Fetch pipelines from GHL
    const response = await ghlClient.getPipelines();

    if (!response.pipelines) {
      return NextResponse.json({ pipelines: [] });
    }

    // Format pipelines with stages
    const pipelines = response.pipelines.map((pipeline: any) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages?.map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        position: stage.position,
      })) || [],
    }));

    return NextResponse.json({ pipelines });
  } catch (error: any) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pipelines' },
      { status: 500 }
    );
  }
}