import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireAuth(request);
    const body = await request.json();
    const { contactId, pipelineId, stageId, name, value } = body;

    if (!contactId || !pipelineId || !stageId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    // Create opportunity in GHL
    const opportunityData: any = {
      contact_id: contactId,
      pipeline_id: pipelineId,
      pipeline_stage_id: stageId,
      name,
      status: 'open',
    };

    if (value) {
      opportunityData.monetary_value = parseFloat(value);
    }

    const response = await ghlClient.post('/opportunities/', opportunityData);

    if (!response.opportunity) {
      throw new Error('Failed to create opportunity');
    }

    // Cache the new opportunity
    const { error: cacheError } = await supabase
      .from('opportunity_cache')
      .upsert({
        organization_id: organizationId,
        opportunity_id: response.opportunity.id,
        contact_id: contactId,
        contact_name: response.opportunity.contact?.name || 'Unknown',
        opportunity_name: name,
        pipeline_id: pipelineId,
        pipeline_stage_id: stageId,
        status: 'open',
        monetary_value: value ? parseFloat(value) : null,
        assigned_to: null,
        created_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      });

    if (cacheError) {
      console.error('Failed to cache opportunity:', cacheError);
    }

    return NextResponse.json({
      success: true,
      opportunity: {
        id: response.opportunity.id,
        name,
        contactId,
        contactName: response.opportunity.contact?.name || 'Unknown',
        pipelineId,
        stageId,
        value: value ? parseFloat(value) : null,
      },
    });
  } catch (error: any) {
    console.error('Error creating opportunity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create opportunity' },
      { status: 500 }
    );
  }
}