import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { ApiKeyManager } from '@/lib/utils/api-key-manager';
import { encrypt } from '@/lib/utils/encryption';
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
    const { integrationId, organizationId } = await request.json();
    const supabase = getServiceSupabase();

    if (!integrationId || !organizationId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get the integration details
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('organization_id', organizationId)
      .eq('type', 'gohighlevel')
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Get organization's OpenAI API key
    const openaiApiKey = await ApiKeyManager.getApiKey(organizationId, 'openai');
    if (!openaiApiKey) {
      console.log('No OpenAI API key found for user, skipping pipeline analysis');
      return NextResponse.json({ 
        success: false, 
        message: 'No OpenAI API key found. Pipeline analysis skipped.' 
      });
    }

    // Create GHL client
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

    // Fetch pipelines from GHL
    const pipelinesResponse = await ghlClient.getPipelines();
    const pipelines = pipelinesResponse.pipelines || [];

    if (pipelines.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No pipelines found in GoHighLevel' 
      });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    const analyzedPipelines = [];
    const completionStages: Record<string, string> = {};

    // Analyze each pipeline
    for (const pipeline of pipelines) {
      if (!pipeline.stages || pipeline.stages.length === 0) continue;

      const stageNames = pipeline.stages.map((s: PipelineStage) => s.name).join(', ');
      
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `You are analyzing sales pipeline stages to identify which stage indicates a deal is won/completed and ready for commission payout.
              
              Common completion stage names include: Won, Closed Won, Completed, Delivered, Paid, Success, Fulfilled, Finished, Done, Signed, Active, Live.
              
              Return a JSON object with:
              - stage_name: The exact name of the completion stage
              - confidence: A score from 0.0 to 1.0
              - reasoning: Brief explanation of why this stage was chosen
              - is_found: true if a completion stage was found, false otherwise`
            },
            {
              role: "user",
              content: `Analyze this pipeline "${pipeline.name}" with stages: ${stageNames}. Which stage indicates the deal is won/completed?`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 500
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');
        
        if (analysis.is_found && analysis.stage_name) {
          // Find the matching stage
          const matchingStage = pipeline.stages.find(
            (s: PipelineStage) => s.name.toLowerCase() === analysis.stage_name.toLowerCase()
          );
          
          if (matchingStage) {
            completionStages[pipeline.id] = matchingStage.id;
            
            // Store the analysis in the database
            const stageData = pipeline.stages.map((stage: PipelineStage) => ({
              user_id: userId,
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

            // Upsert pipeline stages
            const { error: stageError } = await supabase
              .from('pipeline_stages')
              .upsert(stageData, {
                onConflict: 'integration_id,pipeline_id,stage_id'
              });

            if (stageError) {
              console.error('Error saving pipeline stages:', stageError);
            }

            analyzedPipelines.push({
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
              completion_stage_id: matchingStage.id,
              completion_stage_name: matchingStage.name,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning
            });
          }
        }
      } catch (error) {
        console.error(`Error analyzing pipeline ${pipeline.name}:`, error);
        // Continue with next pipeline
      }
    }

    // Update integration with completion stages
    if (Object.keys(completionStages).length > 0) {
      const { error: updateError } = await supabase
        .from('integrations')
        .update({
          pipeline_completion_stages: completionStages,
          last_pipeline_analysis: new Date().toISOString()
        })
        .eq('id', integrationId);

      if (updateError) {
        console.error('Error updating integration:', updateError);
      }
    }

    console.log(`Automatically analyzed ${analyzedPipelines.length} pipelines for integration ${integrationId}`);

    return NextResponse.json({
      success: true,
      analyzed_count: analyzedPipelines.length,
      pipelines: analyzedPipelines,
      message: `Successfully analyzed ${analyzedPipelines.length} pipeline(s) automatically`
    });

  } catch (error) {
    console.error('Error in automatic pipeline analysis:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to analyze pipelines automatically',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}