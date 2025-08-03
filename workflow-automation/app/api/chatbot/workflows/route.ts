import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();

    const { data: workflows, error } = await supabase
      .from('chatbot_workflows')
      .select(`
        *,
        workflow_checkpoints (
          id,
          checkpoint_key,
          checkpoint_type,
          title,
          content,
          position_x,
          position_y,
          next_checkpoint_key
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
    }

    return NextResponse.json({ workflows: workflows || [] });

  } catch (error) {
    console.error('Error in workflows GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const workflowData = await request.json();

    // Validate required fields
    if (!workflowData.name || !workflowData.trigger_tag) {
      return NextResponse.json({ 
        error: 'Name and trigger tag are required' 
      }, { status: 400 });
    }

    // Check if workflow with this trigger tag already exists for this user
    const { data: existingWorkflow } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_tag', workflowData.trigger_tag)
      .single();

    if (existingWorkflow) {
      return NextResponse.json({ 
        error: 'A workflow with this trigger tag already exists' 
      }, { status: 400 });
    }

    // Create new workflow
    const { data: workflow, error } = await supabase
      .from('chatbot_workflows')
      .insert([{
        user_id: userId,
        name: workflowData.name,
        description: workflowData.description || '',
        trigger_tag: workflowData.trigger_tag,
        goal: workflowData.goal || '',
        context: workflowData.context || '',
        knowledge_base: workflowData.knowledge_base || {},
        workflow_config: workflowData.workflow_config || {},
        is_active: workflowData.is_active !== false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow:', error);
      return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Workflow created successfully',
      workflow 
    });

  } catch (error) {
    console.error('Error in workflows POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { workflowId, ...updateData } = await request.json();

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Verify workflow ownership
    const { data: existingWorkflow, error: checkError } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Update workflow
    const { data: workflow, error } = await supabase
      .from('chatbot_workflows')
      .update(updateData)
      .eq('id', workflowId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow:', error);
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Workflow updated successfully',
      workflow 
    });

  } catch (error) {
    console.error('Error in workflows PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('id');

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Verify workflow ownership and delete
    const { error } = await supabase
      .from('chatbot_workflows')
      .delete()
      .eq('id', workflowId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting workflow:', error);
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Workflow deleted successfully' 
    });

  } catch (error) {
    console.error('Error in workflows DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}