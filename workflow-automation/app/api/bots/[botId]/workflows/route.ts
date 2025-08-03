import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { botId } = await params;
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Get workflows with full workflow data
    const { data: botWorkflows, error } = await supabase
      .from('bot_workflows')
      .select(`
        *,
        chatbot_workflows (*)
      `)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Workflows fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workflows' },
        { status: 500 }
      );
    }

    // Return the actual workflow objects
    const workflows = botWorkflows?.map(bw => ({
      ...bw.chatbot_workflows,
      is_primary: bw.is_primary,
      priority: bw.priority
    })) || [];

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Workflows fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { botId } = await params;
    const workflowData = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // First create the workflow in chatbot_workflows table
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .insert([{
        organization_id: organization.organizationId,
        name: workflowData.name || 'Untitled Workflow',
        description: workflowData.description || '',
        trigger_type: 'manual', // Default trigger type
        trigger_config: { tag: `bot-${botId}-workflow` }, // Store tag in trigger_config
        is_active: workflowData.is_active !== false,
        workflow_config: {
          goal: '',
          context: '',
          knowledge_base: {}
        },
        flow_data: workflowData.flow_data || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (workflowError) {
      console.error('Workflow creation error:', workflowError);
      return NextResponse.json(
        { error: 'Failed to create workflow' },
        { status: 500 }
      );
    }

    // Then link it to the bot
    const { error: linkError } = await supabase
      .from('bot_workflows')
      .insert([{
        bot_id: botId,
        workflow_id: workflow.id,
        is_primary: true, // First workflow is primary
        priority: 0,
        created_at: new Date().toISOString()
      }]);

    if (linkError) {
      console.error('Workflow linking error:', linkError);
      // Try to clean up the created workflow
      await supabase
        .from('chatbot_workflows')
        .delete()
        .eq('id', workflow.id);
      
      return NextResponse.json(
        { error: 'Failed to link workflow to bot' },
        { status: 500 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Workflow creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}