import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { workflowId } = await params;
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Verify workflow ownership through chatbot_workflows
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Get nodes
    const { data: nodes, error } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch nodes' },
        { status: 500 }
      );
    }

    return NextResponse.json(nodes || []);
  } catch (error) {
    console.error('Nodes fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { workflowId } = await params;
    const nodes = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    if (!Array.isArray(nodes)) {
      return NextResponse.json(
        { error: 'Nodes must be an array' },
        { status: 400 }
      );
    }

    // Verify workflow ownership
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Delete existing nodes
    await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_id', workflowId);

    // Insert new nodes
    if (nodes.length > 0) {
      const nodesWithWorkflow = nodes.map(node => {
        // Remove the id field if it exists (it should not be included in the insert)
        const { id, ...nodeWithoutId } = node;
        return {
          ...nodeWithoutId,
          workflow_id: workflowId,
          created_at: node.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      const { data: insertedNodes, error: insertError } = await supabase
        .from('workflow_nodes')
        .insert(nodesWithWorkflow)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to save nodes' },
          { status: 500 }
        );
      }
      
      console.log(`Successfully saved ${insertedNodes?.length || 0} nodes for workflow ${workflowId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Nodes save error:', error);
    return NextResponse.json(
      { error: 'Failed to save nodes' },
      { status: 500 }
    );
  }
}