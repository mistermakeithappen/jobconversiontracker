import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const integrationId = searchParams.get('integrationId');

    console.log('Debug: userId =', userId, 'integrationId =', integrationId);

    // Check if integration exists
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .single();

    console.log('Integration check:', { data: integration, error: intError });

    // Check pipeline_stages table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'pipeline_stages' })
      .single();

    console.log('Table info:', { data: tableInfo, error: tableError });

    // Get all pipeline stages for this user (bypass RLS by using service role)
    const { data: allStages, error: allError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId);

    console.log('All stages for user:', { data: allStages, error: allError });

    // Get stages for this specific integration
    const { data: integrationStages, error: intStagesError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integrationId);

    console.log('Integration stages:', { data: integrationStages, error: intStagesError });

    // Get completion stages only
    const { data: completionStages, error: compError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .eq('is_completion_stage', true);

    console.log('Completion stages:', { data: completionStages, error: compError });

    // Test insert a dummy record to see if RLS is the issue
    const testRecord = {
      user_id: userId,
      integration_id: integrationId,
      pipeline_id: 'test_pipeline_123',
      pipeline_name: 'Test Pipeline',
      stage_id: 'test_stage_123',
      stage_name: 'Test Stage',
      stage_position: 1,
      is_completion_stage: true,
      ai_confidence_score: 0.95,
      ai_reasoning: 'Test reasoning',
      analyzed_at: new Date().toISOString()
    };

    const { data: testInsert, error: testError } = await supabase
      .from('pipeline_stages')
      .insert([testRecord])
      .select();

    console.log('Test insert result:', { data: testInsert, error: testError });

    return NextResponse.json({
      debug: true,
      userId,
      integrationId,
      integration: { data: integration, error: intError },
      allStages: { data: allStages, error: allError },
      integrationStages: { data: integrationStages, error: intStagesError },
      completionStages: { data: completionStages, error: compError },
      testInsert: { data: testInsert, error: testError }
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      error: 'Debug API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}