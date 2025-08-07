import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

// API endpoint for updating pipeline stage settings (revenue recognition and commission stages)

interface StageUpdate {
  revenueStageId?: string;
  completionStageId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get user and organization
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { integrationId, changes } = body;

    console.log('Update stages request received:', { 
      organizationId: organization.organizationId, 
      integrationId,
      changes,
      userId
    });

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    if (!changes || typeof changes !== 'object') {
      return NextResponse.json({ error: 'Changes object required' }, { status: 400 });
    }
    
    // Check if there are any changes to process
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No changes to save'
      });
    }

    // First, ensure we have stage records for this integration
    // Get all pipelines and stages from the integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Process each pipeline's changes
    for (const [pipelineId, stageUpdate] of Object.entries(changes)) {
      const update = stageUpdate as StageUpdate;
      
      console.log(`Processing pipeline ${pipelineId}:`, update);
      
      // Reset all stages for this pipeline first
      const { data: existingStages, error: fetchError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .eq('integration_id', integrationId)
        .eq('ghl_pipeline_id', pipelineId);
      
      if (fetchError) {
        console.error('Error fetching existing stages:', fetchError);
      }
      
      console.log(`Found ${existingStages?.length || 0} existing stages for pipeline ${pipelineId}`);
      
      // Reset stages if they exist - but only the fields we're updating
      if (existingStages && existingStages.length > 0) {
        // Only reset revenue stages if we're updating revenue
        if (update.revenueStageId !== undefined) {
          const { error: resetRevenueError } = await supabase
            .from('pipeline_stages')
            .update({
              is_revenue_recognition_stage: false,
              revenue_stage_override: false,
              revenue_stage_overridden_at: null,
              revenue_stage_overridden_by: null
            })
            .eq('organization_id', organization.organizationId)
            .eq('integration_id', integrationId)
            .eq('ghl_pipeline_id', pipelineId);
          
          if (resetRevenueError) {
            console.error('Error resetting revenue stages:', resetRevenueError);
          }
        }
        
        // Only reset completion stages if we're updating completion
        if (update.completionStageId !== undefined) {
          const { error: resetCompletionError } = await supabase
            .from('pipeline_stages')
            .update({
              is_completion_stage: false,
              commission_stage_override: false,
              commission_stage_overridden_at: null,
              commission_stage_overridden_by: null
            })
            .eq('organization_id', organization.organizationId)
            .eq('integration_id', integrationId)
            .eq('ghl_pipeline_id', pipelineId);
          
          if (resetCompletionError) {
            console.error('Error resetting completion stages:', resetCompletionError);
          }
        }
      } else {
        console.log(`No existing stages to reset for pipeline ${pipelineId}`);
      }
      
      // Update revenue recognition stage if specified
      if (update.revenueStageId) {
        // Check if the stage exists
        const stageExists = existingStages?.some(s => s.ghl_stage_id === update.revenueStageId);
        
        if (!stageExists) {
          console.log(`Stage ${update.revenueStageId} doesn't exist in database, skipping update`);
          // You might want to create the stage record here if needed
          // For now, we'll just log and continue
        } else {
          const { error: revenueError } = await supabase
            .from('pipeline_stages')
            .update({
              is_revenue_recognition_stage: true,
              revenue_stage_override: true,
              revenue_stage_overridden_at: new Date().toISOString(),
              revenue_stage_overridden_by: userId,
              revenue_stage_reasoning: 'Manually set by user'
            })
            .eq('organization_id', organization.organizationId)
            .eq('integration_id', integrationId)
            .eq('ghl_pipeline_id', pipelineId)
            .eq('ghl_stage_id', update.revenueStageId);
          
          if (revenueError) {
            console.error('Error updating revenue stage:', revenueError);
          } else {
            console.log(`Successfully updated revenue stage ${update.revenueStageId}`);
          }
        }
      }
      
      // Update completion/commission stage if specified
      if (update.completionStageId) {
        // Check if the stage exists
        const stageExists = existingStages?.some(s => s.ghl_stage_id === update.completionStageId);
        
        if (!stageExists) {
          console.log(`Stage ${update.completionStageId} doesn't exist in database, skipping update`);
        } else {
          const { error: completionError } = await supabase
            .from('pipeline_stages')
            .update({
              is_completion_stage: true,
              commission_stage_override: true,
              commission_stage_overridden_at: new Date().toISOString(),
              commission_stage_overridden_by: userId,
              ai_reasoning: 'Manually set by user'
            })
            .eq('organization_id', organization.organizationId)
            .eq('integration_id', integrationId)
            .eq('ghl_pipeline_id', pipelineId)
            .eq('ghl_stage_id', update.completionStageId);
          
          if (completionError) {
            console.error('Error updating completion stage:', completionError);
          } else {
            console.log(`Successfully updated completion stage ${update.completionStageId}`);
          }
        }
      }
    }

    // Update the integration's pipeline stage mappings
    const pipelineCompletionStages: Record<string, string> = {};
    const pipelineRevenueStages: Record<string, string> = {};
    
    for (const [pipelineId, stageUpdate] of Object.entries(changes)) {
      const update = stageUpdate as StageUpdate;
      if (update.completionStageId) {
        pipelineCompletionStages[pipelineId] = update.completionStageId;
      }
      if (update.revenueStageId) {
        pipelineRevenueStages[pipelineId] = update.revenueStageId;
      }
    }
    
    // Get current integration data (already fetched above, so use existing variable)
    if (integration) {
      // Merge with existing stages
      const updatedCompletionStages = {
        ...(integration.pipeline_completion_stages || {}),
        ...pipelineCompletionStages
      };
      
      const updatedRevenueStages = {
        ...(integration.pipeline_revenue_stages || {}),
        ...pipelineRevenueStages
      };
      
      // Update integration
      const { error: updateError } = await supabase
        .from('integrations')
        .update({
          pipeline_completion_stages: updatedCompletionStages,
          pipeline_revenue_stages: updatedRevenueStages
        })
        .eq('id', integrationId)
        .eq('organization_id', organization.organizationId);
      
      if (updateError) {
        console.error('Error updating integration:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update integration',
          details: updateError.message 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pipeline stages updated successfully'
    });

  } catch (error) {
    console.error('Error in update-stages API:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // More detailed error response for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      type: error?.constructor?.name || 'Unknown',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    };
    
    return NextResponse.json({ 
      error: 'Failed to update pipeline stages',
      details: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    }, { status: 500 });
  }
}