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

    // Get connections
    const { data: connections, error } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      );
    }

    return NextResponse.json(connections || []);
  } catch (error) {
    console.error('Connections fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
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
    const connections = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    if (!Array.isArray(connections)) {
      return NextResponse.json(
        { error: 'Connections must be an array' },
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

    // Delete existing connections
    await supabase
      .from('workflow_connections')
      .delete()
      .eq('workflow_id', workflowId);

    // Insert new connections
    if (connections.length > 0) {
      const connectionsWithWorkflow = connections.map(conn => ({
        ...conn,
        workflow_id: workflowId,
        created_at: conn.created_at || new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('workflow_connections')
        .insert(connectionsWithWorkflow);

      if (insertError) {
        console.error('Insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to save connections' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connections save error:', error);
    return NextResponse.json(
      { error: 'Failed to save connections' },
      { status: 500 }
    );
  }
}