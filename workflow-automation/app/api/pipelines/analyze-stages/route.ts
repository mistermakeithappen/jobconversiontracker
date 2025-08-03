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
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    const supabase = getServiceSupabase();
    const { pipelines, integrationId } = await request.json();

    console.log('Pipeline analysis started for organizationId:', organization.organizationId, 'integrationId:', integrationId);

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

    // Analyze each pipeline
    for (const pipeline of pipelines) {
      if (!pipeline.stages || pipeline.stages.length === 0) continue;

      const stageNames = pipeline.stages.map((s: PipelineStage) => s.name).join(', ');
      
      // First, try rule-based detection for common completion stages
      const completionKeywords = ['won', 'closed won', 'complete', 'completed', 'success', 'delivered', 'done', 'finished', 'fulfilled', 'live', 'active'];
      
      let ruleBasedMatch = null;
      for (const stage of pipeline.stages) {
        const stageName = stage.name.toLowerCase().trim();
        if (completionKeywords.includes(stageName)) {
          ruleBasedMatch = {
            stage_name: stage.name,
            confidence: 0.95,
            reasoning: `Rule-based match: "${stage.name}" is a standard completion stage name`,
            is_found: true,
            method: 'rule-based'
          };
          break;
        }
      }
      
      console.log(`Rule-based analysis for pipeline "${pipeline.name}":`, ruleBasedMatch);
      
      let analysis = ruleBasedMatch;
      
      // If no rule-based match, try AI analysis for more complex cases
      if (!ruleBasedMatch) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: `Find the completion stage in: ${stageNames}
                
                Return JSON: {"stage_name": "exact name", "confidence": 0.9, "reasoning": "why", "is_found": true/false}`
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 200
          });

          analysis = JSON.parse(completion.choices[0].message.content || '{}');
          analysis.method = 'ai-based';
          console.log(`AI Analysis for pipeline "${pipeline.name}":`, analysis);
        } catch (aiError) {
          console.error('AI analysis failed:', aiError);
          analysis = { is_found: false, method: 'failed' };
        }
      }
      
      console.log(`Final analysis for pipeline "${pipeline.name}":`, analysis);
      console.log(`Available stages were: ${stageNames}`);
      
      if (analysis && analysis.is_found && analysis.stage_name) {
        // Find the matching stage
        const matchingStage = pipeline.stages.find(
          (s: PipelineStage) => s.name.toLowerCase() === analysis.stage_name.toLowerCase()
        );
        
        if (matchingStage) {
          completionStages[pipeline.id] = matchingStage.id;
          
          // Store the analysis in the database
          const stageData = pipeline.stages.map((stage: PipelineStage) => ({
            organization_id: organization.organizationId,
            integration_id: integrationId,
            pipeline_id: pipeline.id,
            pipeline_name: pipeline.name,
            stage_id: stage.id,
            stage_name: stage.name,
            stage_position: stage.position,
            is_completion_stage: stage.id === matchingStage.id,
            ai_confidence_score: stage.id === matchingStage.id ? analysis.confidence : null,
            ai_reasoning: stage.id === matchingStage.id ? analysis.reasoning : null,
            analyzed_at: stage.id === matchingStage.id ? new Date().toISOString() : null
          }));

          console.log('Attempting to save stage data:', stageData);

          // For now, let's skip saving to pipeline_stages table and just save to integrations
          // We'll fix the RLS issue in the database later
          console.log('Skipping pipeline_stages insert due to RLS issue');
          console.log('Stage data that would be saved:', stageData.filter(s => s.is_completion_stage));

          analyzedPipelines.push({
            pipeline_id: pipeline.id,
            pipeline_name: pipeline.name,
            completion_stage_id: matchingStage.id,
            completion_stage_name: matchingStage.name,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning
          });
        } else {
          console.log(`No matching stage found for "${analysis.stage_name}" in pipeline "${pipeline.name}"`);
        }
      } else {
        console.log(`No fulfillment completion stage found in pipeline "${pipeline.name}". Analysis result:`, analysis);
        
        // Still create a record but mark it as having no fulfillment stage
        const stageData = pipeline.stages.map((stage: PipelineStage) => ({
          organization_id: organization.organizationId,
          integration_id: integrationId,
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          stage_id: stage.id,
          stage_name: stage.name,
          stage_position: stage.position,
          is_completion_stage: false,
          ai_confidence_score: null,
          ai_reasoning: 'No fulfillment completion stage identified - pipeline appears to be sales-focused only',
          analyzed_at: new Date().toISOString()
        }));

        // For now, skip saving to pipeline_stages table due to RLS issue
        console.log('Pipeline has no fulfillment completion stage:', pipeline.name);
      }
    }

    // Update integration with completion stages
    if (Object.keys(completionStages).length > 0) {
      const { error: updateError } = await supabase
        .from('integrations')
        .update({
          pipeline_completion_stages: completionStages
        })
        .eq('id', integrationId);

      if (updateError) {
        console.error('Error updating integration:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      analyzed_count: analyzedPipelines.length,
      pipelines: analyzedPipelines
    });

  } catch (error) {
    console.error('Error analyzing pipeline stages:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze pipeline stages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}