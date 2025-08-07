import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { ApiKeyManager } from '@/lib/utils/api-key-manager';
import OpenAI from 'openai';

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('Analyze-stages endpoint called');
    
    const { userId } = await requireAuth(request);
    console.log('User authenticated:', userId);
    
    const organization = await getUserOrganization(userId);
    console.log('Organization found:', organization?.organizationId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { pipelines, integrationId } = body;

    console.log('Pipeline analysis started for organizationId:', organization.organizationId, 'integrationId:', integrationId);
    console.log('Number of pipelines received:', pipelines?.length);

    if (!pipelines || !Array.isArray(pipelines) || pipelines.length === 0) {
      return NextResponse.json({ error: 'No pipelines provided' }, { status: 400 });
    }

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    // Get organization's OpenAI API key using the ApiKeyManager
    const openaiApiKey = await ApiKeyManager.getApiKey(organization.organizationId, 'openai');

    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not found. Please add your OpenAI API key in settings.' 
      }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    const analyzedPipelines = [];
    const completionStages: Record<string, string> = {};
    const revenueStages: Record<string, string> = {};

    // Analyze each pipeline
    for (const pipeline of pipelines) {
      if (!pipeline.stages || pipeline.stages.length === 0) continue;

      const stageNames = pipeline.stages.map((s: PipelineStage) => s.name).join(', ');
      
      // Rule-based detection for revenue recognition stages (first stage where revenue counts)
      const revenueKeywords = ['closed won', 'won', 'signed', 'approved', 'confirmed', 'accepted', 'contracted'];
      const preRevenueKeywords = ['estimate', 'quote', 'proposal', 'pitch', 'negotiation', 'opportunity', 'lead', 'prospect', 'qualification'];
      
      let revenueStageMatch = null;
      let firstRevenueStage = null;
      
      // Find the first stage that represents actual revenue commitment
      for (const stage of pipeline.stages) {
        const stageName = stage.name.toLowerCase().trim();
        const isPreRevenue = preRevenueKeywords.some(keyword => stageName.includes(keyword));
        const isRevenue = revenueKeywords.some(keyword => stageName.includes(keyword));
        
        if (isRevenue && !firstRevenueStage) {
          firstRevenueStage = {
            stage_name: stage.name,
            confidence: 0.95,
            reasoning: `Rule-based match: "${stage.name}" indicates confirmed revenue`,
            is_found: true,
            method: 'rule-based'
          };
          break;
        } else if (!isPreRevenue && !firstRevenueStage && stage.position > 0) {
          // If no clear revenue keyword but past pre-revenue stages
          const prevStages = pipeline.stages.filter((s: PipelineStage) => s.position < stage.position);
          const allPrevPreRevenue = prevStages.every((s: PipelineStage) => 
            preRevenueKeywords.some(keyword => s.name.toLowerCase().includes(keyword))
          );
          
          if (allPrevPreRevenue) {
            firstRevenueStage = {
              stage_name: stage.name,
              confidence: 0.75,
              reasoning: `Position-based: "${stage.name}" appears to be the first post-sales stage`,
              is_found: true,
              method: 'rule-based'
            };
            break;
          }
        }
      }
      
      revenueStageMatch = firstRevenueStage;
      
      // Rule-based detection for commission/completion stages
      const completionKeywords = ['won', 'closed won', 'complete', 'completed', 'success', 'delivered', 'done', 'finished', 'fulfilled', 'live', 'active'];
      
      let completionStageMatch = null;
      for (const stage of pipeline.stages) {
        const stageName = stage.name.toLowerCase().trim();
        if (completionKeywords.includes(stageName)) {
          completionStageMatch = {
            stage_name: stage.name,
            confidence: 0.95,
            reasoning: `Rule-based match: "${stage.name}" is a standard completion stage name`,
            is_found: true,
            method: 'rule-based'
          };
          break;
        }
      }
      
      console.log(`Rule-based revenue analysis for pipeline "${pipeline.name}":`, revenueStageMatch);
      console.log(`Rule-based completion analysis for pipeline "${pipeline.name}":`, completionStageMatch);
      
      let completionAnalysis = completionStageMatch;
      let revenueAnalysis = revenueStageMatch;
      
      // If no rule-based matches, try AI analysis for more complex cases
      if (!completionStageMatch || !revenueStageMatch) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: `Analyze this sales pipeline stages: ${stageNames}
                
                Find TWO critical stages:
                1. Revenue Recognition Stage: The FIRST stage where the deal is confirmed/won and revenue should be counted (not just quoted/estimated)
                2. Completion Stage: The stage where the project/service is fully delivered and commissions are due
                
                Return JSON:
                {
                  "revenue_stage": {"stage_name": "exact name", "confidence": 0.9, "reasoning": "why this is where revenue starts counting", "is_found": true/false},
                  "completion_stage": {"stage_name": "exact name", "confidence": 0.9, "reasoning": "why commissions are due here", "is_found": true/false}
                }`
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 400
          });

          const aiResult = JSON.parse(completion.choices[0].message.content || '{}');
          
          if (!completionStageMatch && aiResult.completion_stage) {
            completionAnalysis = { ...aiResult.completion_stage, method: 'ai-based' };
          }
          
          if (!revenueStageMatch && aiResult.revenue_stage) {
            revenueAnalysis = { ...aiResult.revenue_stage, method: 'ai-based' };
          }
          
          console.log(`AI Analysis for pipeline "${pipeline.name}":`, aiResult);
        } catch (aiError) {
          console.error('AI analysis failed:', aiError);
          if (!completionAnalysis) completionAnalysis = { is_found: false, method: 'failed' };
          if (!revenueAnalysis) revenueAnalysis = { is_found: false, method: 'failed' };
        }
      }
      
      console.log(`Final completion analysis for pipeline "${pipeline.name}":`, completionAnalysis);
      console.log(`Final revenue analysis for pipeline "${pipeline.name}":`, revenueAnalysis);
      console.log(`Available stages were: ${stageNames}`);
      
      // Process completion stage
      let completionStageId = null;
      let completionStageName = null;
      if (completionAnalysis && completionAnalysis.is_found && completionAnalysis.stage_name) {
        const matchingStage = pipeline.stages.find(
          (s: PipelineStage) => s.name.toLowerCase() === completionAnalysis.stage_name.toLowerCase()
        );
        
        if (matchingStage) {
          completionStageId = matchingStage.id;
          completionStageName = matchingStage.name;
          completionStages[pipeline.id] = matchingStage.id;
        }
      }
      
      // Process revenue recognition stage
      let revenueStageId = null;
      let revenueStageName = null;
      if (revenueAnalysis && revenueAnalysis.is_found && revenueAnalysis.stage_name) {
        const matchingStage = pipeline.stages.find(
          (s: PipelineStage) => s.name.toLowerCase() === revenueAnalysis.stage_name.toLowerCase()
        );
        
        if (matchingStage) {
          revenueStageId = matchingStage.id;
          revenueStageName = matchingStage.name;
          revenueStages[pipeline.id] = matchingStage.id;
        }
      }
      
      // Store the analysis in the database
      const stageData = pipeline.stages.map((stage: PipelineStage) => ({
        organization_id: organization.organizationId,
        integration_id: integrationId,
        ghl_pipeline_id: pipeline.id,
        pipeline_name: pipeline.name,
        ghl_stage_id: stage.id,
        stage_name: stage.name,
        stage_position: stage.position,
        // Commission stage fields
        is_completion_stage: stage.id === completionStageId,
        ai_confidence_score: stage.id === completionStageId ? completionAnalysis?.confidence : null,
        ai_reasoning: stage.id === completionStageId ? completionAnalysis?.reasoning : null,
        // Revenue recognition fields
        is_revenue_recognition_stage: stage.id === revenueStageId,
        revenue_stage_confidence_score: stage.id === revenueStageId ? revenueAnalysis?.confidence : null,
        revenue_stage_reasoning: stage.id === revenueStageId ? revenueAnalysis?.reasoning : null,
        last_analyzed_at: new Date().toISOString()
      }));

      // Save to database
      try {
        // First, try to delete existing stages for this pipeline to avoid conflicts
        const { error: deleteError } = await supabase
          .from('pipeline_stages')
          .delete()
          .eq('organization_id', organization.organizationId)
          .eq('integration_id', integrationId)
          .eq('ghl_pipeline_id', pipeline.id);
        
        if (deleteError) {
          console.error('Error deleting existing stages:', deleteError);
        }
        
        // Now insert the new stage data
        const { error: insertError } = await supabase
          .from('pipeline_stages')
          .insert(stageData);
        
        if (insertError) {
          console.error('Error saving pipeline stages:', insertError);
          console.error('Stage data that failed:', stageData);
        } else {
          console.log('Successfully saved pipeline stages for:', pipeline.name);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      analyzedPipelines.push({
        pipeline_id: pipeline.id,
        pipeline_name: pipeline.name,
        completion_stage_id: completionStageId,
        completion_stage_name: completionStageName,
        completion_confidence: completionAnalysis?.confidence,
        completion_reasoning: completionAnalysis?.reasoning,
        revenue_stage_id: revenueStageId,
        revenue_stage_name: revenueStageName,
        revenue_confidence: revenueAnalysis?.confidence,
        revenue_reasoning: revenueAnalysis?.reasoning
      });
    }

    // Update integration with both completion and revenue stages
    if (Object.keys(completionStages).length > 0 || Object.keys(revenueStages).length > 0) {
      const { error: updateError } = await supabase
        .from('integrations')
        .update({
          pipeline_completion_stages: completionStages,
          pipeline_revenue_stages: revenueStages
        })
        .eq('id', integrationId);

      if (updateError) {
        console.error('Error updating integration:', updateError);
      } else {
        console.log(`Updated integration with ${Object.keys(completionStages).length} completion stages and ${Object.keys(revenueStages).length} revenue stages`);
      }
    }

    return NextResponse.json({
      success: true,
      analyzed_count: analyzedPipelines.length,
      pipelines: analyzedPipelines
    });

  } catch (error) {
    console.error('Error analyzing pipeline stages:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Provide more detailed error response
    let errorMessage = 'Failed to analyze pipeline stages';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('OpenAI')) {
        errorMessage = 'OpenAI API error: ' + error.message;
        statusCode = 400;
      } else if (error.message.includes('database')) {
        errorMessage = 'Database error: ' + error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || 'UnknownError'
    }, { status: statusCode });
  }
}