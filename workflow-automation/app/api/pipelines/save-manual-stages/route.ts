import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

// Simplified API endpoint for manually setting pipeline stages without AI analysis

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { integrationId, pipelines } = body;

    console.log('Manual stage save request:', { 
      organizationId: organization.organizationId, 
      integrationId,
      pipelinesCount: pipelines?.length 
    });

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    if (!pipelines || !Array.isArray(pipelines)) {
      return NextResponse.json({ error: 'Pipelines data required' }, { status: 400 });
    }

    // Process each pipeline
    for (const pipeline of pipelines) {
      const { pipelineId, pipelineName, stages, revenueStageId, completionStageId } = pipeline;
      
      console.log(`Processing pipeline ${pipelineId}: revenue=${revenueStageId}, completion=${completionStageId}`);
      
      // Delete existing stage records for this pipeline
      const { error: deleteError } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('organization_id', organization.organizationId)
        .eq('integration_id', integrationId)
        .eq('ghl_pipeline_id', pipelineId);
      
      if (deleteError) {
        console.error('Error deleting existing stages:', deleteError);
      }
      
      // Create new stage records
      const stageRecords = stages.map((stage: any) => ({
        organization_id: organization.organizationId,
        integration_id: integrationId,
        ghl_pipeline_id: pipelineId,
        pipeline_name: pipelineName,
        ghl_stage_id: stage.id,
        stage_name: stage.name,
        stage_position: stage.position,
        is_revenue_recognition_stage: stage.id === revenueStageId,
        is_completion_stage: stage.id === completionStageId,
        revenue_stage_override: stage.id === revenueStageId,
        commission_stage_override: stage.id === completionStageId,
        revenue_stage_overridden_at: stage.id === revenueStageId ? new Date().toISOString() : null,
        commission_stage_overridden_at: stage.id === completionStageId ? new Date().toISOString() : null,
        revenue_stage_overridden_by: stage.id === revenueStageId ? userId : null,
        commission_stage_overridden_by: stage.id === completionStageId ? userId : null,
        revenue_stage_reasoning: stage.id === revenueStageId ? 'Manually set by user' : null,
        ai_reasoning: stage.id === completionStageId ? 'Manually set by user' : null,
        last_analyzed_at: new Date().toISOString()
      }));
      
      // Insert new stage records
      const { error: insertError } = await supabase
        .from('pipeline_stages')
        .insert(stageRecords);
      
      if (insertError) {
        console.error('Error inserting stages:', insertError);
        return NextResponse.json({ 
          error: 'Failed to save pipeline stages',
          details: insertError.message 
        }, { status: 500 });
      }
    }
    
    // Update the integration's stage mappings
    const revenueStages: Record<string, string> = {};
    const completionStages: Record<string, string> = {};
    
    for (const pipeline of pipelines) {
      if (pipeline.revenueStageId) {
        revenueStages[pipeline.pipelineId] = pipeline.revenueStageId;
      }
      if (pipeline.completionStageId) {
        completionStages[pipeline.pipelineId] = pipeline.completionStageId;
      }
    }
    
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        pipeline_revenue_stages: revenueStages,
        pipeline_completion_stages: completionStages
      })
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId);
    
    if (updateError) {
      console.error('Error updating integration:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Pipeline stages saved successfully'
    });

  } catch (error) {
    console.error('Error in save-manual-stages API:', error);
    return NextResponse.json({ 
      error: 'Failed to save pipeline stages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}