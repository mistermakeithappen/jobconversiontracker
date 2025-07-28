import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const startAfterId = searchParams.get('startAfterId') || undefined;
    const pipelineId = searchParams.get('pipelineId') || undefined;
    
    // Get user's GHL integration
    let { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .single();
    
    if (error || !integration || !integration.config.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel not connected' }, { status: 400 });
    }
    
    // Check if we have a locationId, if not, we need to fetch it first
    if (!integration.config.locationId) {
      console.log('No locationId found, attempting to fetch locations first');
      
      // Call the locations endpoint to get and set the locationId
      const locationsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/automake/locations`, {
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      
      if (!locationsResponse.ok) {
        return NextResponse.json({ 
          error: 'Unable to fetch location information. Please reconnect GoHighLevel.' 
        }, { status: 400 });
      }
      
      await locationsResponse.json(); // This updates the integration with locationId
      
      // Re-fetch the integration to get the updated locationId
      const { data: updatedIntegration } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'gohighlevel')
        .single();
        
      if (updatedIntegration) {
        integration = updatedIntegration;
      }
      
      // If still no locationId, we can't proceed
      if (!integration.config.locationId) {
        return NextResponse.json({ 
          error: 'No accessible locations found for this GoHighLevel account.' 
        }, { status: 400 });
      }
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
      // Get pipelines for mapping (this works)
      const pipelinesResponse = await ghlClient.getPipelines();
      const pipelines = pipelinesResponse.pipelines || [];
      
      console.log('Pipelines response:', JSON.stringify(pipelinesResponse, null, 2));
      console.log('Number of pipelines found:', pipelines.length);
      
      // Try to fetch real opportunities using the search endpoint
      console.log('Attempting to fetch real opportunities using search endpoint...');
      
      let opportunities = [];
      let useRealData = false;
      let paginationMeta = {};
      
      try {
        // Use getAllOpportunities to fetch ALL opportunities with pagination
        const opportunitiesResponse = await ghlClient.getAllOpportunities({
          locationId: integration.config.locationId,
          pipelineId, // Filter by specific pipeline if provided
          maxResults: 5000 // Reasonable limit to prevent excessive API calls
        });
        
        console.log('All Opportunities API response:', {
          count: opportunitiesResponse.opportunities?.length || 0,
          requestCount: opportunitiesResponse.requestCount,
          hasError: !!opportunitiesResponse.error,
          meta: opportunitiesResponse.meta
        });
        
        if (opportunitiesResponse.opportunities && opportunitiesResponse.opportunities.length > 0) {
          opportunities = opportunitiesResponse.opportunities;
          useRealData = true;
          paginationMeta = {
            requestCount: opportunitiesResponse.requestCount,
            maxResultsReached: opportunitiesResponse.meta?.maxResultsReached,
            totalFetched: opportunitiesResponse.meta?.totalFetched
          };
          console.log(`Successfully fetched ${opportunities.length} real opportunities in ${opportunitiesResponse.requestCount} API requests`);
        } else if (opportunitiesResponse.error) {
          console.log('Opportunities API failed, falling back to mock data:', opportunitiesResponse.error);
        } else {
          console.log('No opportunities found, will generate mock data');
        }
      } catch (opportunitiesError) {
        console.log('Opportunities search failed, falling back to mock data:', opportunitiesError);
      }
      
      // If real API failed or returned no data, generate mock data
      let mockOpportunities = [];
      
      if (pipelines.length > 0) {
        // Generate mock opportunities based on real pipeline data
        mockOpportunities = pipelines.flatMap((pipeline: any, pipelineIndex: number) => 
          (pipeline.stages || []).map((stage: any, stageIndex: number) => ({
            id: `mock-${pipeline.id}-${stage.id}-${stageIndex}`,
            name: `Sample Job ${pipelineIndex + 1}.${stageIndex + 1}`,
            contactId: `contact-${pipelineIndex}-${stageIndex}`,
            contact: {
              name: `Client ${pipelineIndex + 1}.${stageIndex + 1}`,
              email: `client${pipelineIndex}${stageIndex}@example.com`
            },
            pipelineId: pipeline.id,
            pipelineStageId: stage.id,
            status: 'open',
            monetaryValue: Math.floor(Math.random() * 50000) + 5000,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          }))
        );
      } else {
        // Fallback mock data if no pipelines are available
        console.log('No pipelines found, creating fallback mock data');
        const fallbackPipelines = [
          {
            id: 'mock-pipeline-1',
            name: 'Sales Pipeline',
            stages: [
              { id: 'mock-stage-1', name: 'Lead', position: 1 },
              { id: 'mock-stage-2', name: 'Qualified', position: 2 },
              { id: 'mock-stage-3', name: 'Proposal', position: 3 },
              { id: 'mock-stage-4', name: 'Closed Won', position: 4 }
            ]
          }
        ];
        
        pipelines.push(...fallbackPipelines);
        
        mockOpportunities = fallbackPipelines.flatMap((pipeline: any, pipelineIndex: number) => 
          (pipeline.stages || []).map((stage: any, stageIndex: number) => ({
            id: `mock-${pipeline.id}-${stage.id}-${stageIndex}`,
            name: `Sample Job ${pipelineIndex + 1}.${stageIndex + 1}`,
            contactId: `contact-${pipelineIndex}-${stageIndex}`,
            contact: {
              name: `Client ${pipelineIndex + 1}.${stageIndex + 1}`,
              email: `client${pipelineIndex}${stageIndex}@example.com`
            },
            pipelineId: pipeline.id,
            pipelineStageId: stage.id,
            status: 'open',
            monetaryValue: Math.floor(Math.random() * 50000) + 5000,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          }))
        );
      }
      
      console.log('Generated mock opportunities:', mockOpportunities.length);
      
      // Use real data if available, otherwise use mock data
      const finalOpportunities = useRealData ? opportunities : mockOpportunities;
      
      const response = {
        opportunities: finalOpportunities,
        total: finalOpportunities.length,
        isRealData: useRealData,
        ...paginationMeta
      };
      
      // Create a map of pipeline and stage info
      const pipelineMap = new Map();
      const stageMap = new Map();
      
      pipelines.forEach((pipeline: any) => {
        pipelineMap.set(pipeline.id, pipeline.name);
        if (pipeline.stages) {
          pipeline.stages.forEach((stage: any) => {
            stageMap.set(stage.id, stage.name);
          });
        }
      });
      
      // Transform and cache opportunities
      const opportunitiesData = await Promise.all(
        (response.opportunities || []).map(async (opp: any) => {
          // Handle both real GHL API format and mock data format
          const opportunityData = {
            user_id: userId,
            opportunity_id: opp.id,
            integration_id: integration.id,
            name: opp.name || opp.title || 'Unnamed Opportunity',
            contact_id: opp.contactId || opp.contact?.id || opp.contact_id,
            contact_name: opp.contact?.name || opp.contact?.firstName + ' ' + opp.contact?.lastName || opp.contact?.email || 'Unknown Contact',
            pipeline_id: opp.pipelineId || opp.pipeline_id,
            pipeline_name: pipelineMap.get(opp.pipelineId || opp.pipeline_id) || 'Unknown Pipeline',
            pipeline_stage_id: opp.pipelineStageId || opp.pipeline_stage_id,
            pipeline_stage_name: stageMap.get(opp.pipelineStageId || opp.pipeline_stage_id) || 'Unknown Stage',
            status: opp.status || 'open',
            monetary_value: opp.monetaryValue || opp.monetary_value || 0,
            assigned_to: opp.assignedTo || opp.assignedUserId || opp.assigned_to || null,
            assigned_to_name: opp.assignedToName || opp.assignedUserName || null,
            ghl_created_at: opp.createdAt || opp.dateAdded || opp.created_at,
            ghl_updated_at: opp.updatedAt || opp.dateUpdated || opp.updated_at,
            synced_at: new Date().toISOString()
          };
          
          // Upsert to cache
          await supabase
            .from('opportunity_cache')
            .upsert(opportunityData, { onConflict: 'opportunity_id' })
            .select()
            .single();
          
          // Get receipt data for this opportunity
          const { data: receipts } = await supabase
            .from('opportunity_receipts')
            .select('amount')
            .eq('opportunity_id', opp.id);
          
          const materialExpenses = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
          
          // Get labor costs for this opportunity
          const { data: timeEntries } = await supabase
            .from('time_entries')
            .select('total_cost')
            .eq('opportunity_id', opp.id);
          
          const laborExpenses = timeEntries?.reduce((sum, t) => sum + Number(t.total_cost), 0) || 0;
          
          // Get commission data for this opportunity
          const { data: commissions } = await supabase
            .from('opportunity_commissions')
            .select('commission_type, commission_percentage, ghl_user_id')
            .eq('opportunity_id', opp.id);
          
          // Remove duplicate commissions (by ghl_user_id and commission_type)
          const uniqueCommissions = commissions?.filter((commission, index, self) => 
            index === self.findIndex(c => 
              c.ghl_user_id === commission.ghl_user_id && 
              c.commission_type === commission.commission_type
            )
          ) || [];
          
          // Calculate commissions
          let grossCommissions = 0;
          let profitCommissions = 0;
          
          if (uniqueCommissions && uniqueCommissions.length > 0) {
            
            // Calculate gross-based commissions first (based on total revenue)
            grossCommissions = uniqueCommissions
              .filter(c => c.commission_type === 'gross')
              .reduce((sum, c) => sum + (opportunityData.monetary_value * c.commission_percentage / 100), 0);
            
            // Calculate expenses (material + labor + gross commissions)
            const baseExpenses = materialExpenses + laborExpenses + grossCommissions;
            const netBeforeCommissions = opportunityData.monetary_value - baseExpenses;
            
            // Calculate profit-based commissions on the net profit (before profit commissions)
            profitCommissions = uniqueCommissions
              .filter(c => c.commission_type === 'profit')
              .reduce((sum, c) => {
                const percentage = Number(c.commission_percentage);
                const commission = Math.max(0, netBeforeCommissions) * percentage / 100;
                return sum + commission;
              }, 0);
          }
          
          const totalCommissions = grossCommissions + profitCommissions;
          const totalExpenses = materialExpenses + laborExpenses + totalCommissions;
          const netProfit = opportunityData.monetary_value - totalExpenses;
          
          return {
            id: opp.id,
            name: opportunityData.name,
            contactName: opportunityData.contact_name,
            pipelineName: opportunityData.pipeline_name,
            stageName: opportunityData.pipeline_stage_name,
            status: opportunityData.status,
            monetaryValue: opportunityData.monetary_value,
            totalExpenses,
            materialExpenses,
            laborExpenses,
            totalCommissions,
            grossCommissions,
            profitCommissions,
            netProfit,
            profitMargin: opportunityData.monetary_value > 0 
              ? (netProfit / opportunityData.monetary_value * 100)
              : 0,
            createdAt: opp.createdAt,
            updatedAt: opp.updatedAt
          };
        })
      );
      
      return NextResponse.json({ 
        opportunities: opportunitiesData,
        pipelines,
        total: response.total || opportunitiesData.length,
        limit,
        startAfterId: response.meta?.startAfterId,
        isRealData: response.isRealData
      });
      
    } catch (apiError: any) {
      console.error('GHL API error:', apiError);
      console.error('Error details:', {
        message: apiError.message,
        response: apiError.response,
        status: apiError.status
      });
      
      if (apiError.message?.includes('401') || apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Authentication failed. Please reconnect GoHighLevel.' }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: apiError.message || 'Failed to fetch opportunities',
        details: apiError.toString()
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}