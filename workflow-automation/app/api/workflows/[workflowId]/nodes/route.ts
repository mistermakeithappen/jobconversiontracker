import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';

interface WorkflowNode {
  id?: string;
  workflow_id: string;
  node_id: string;
  node_type: 'start' | 'milestone' | 'book_appointment' | 'message' | 'condition' | 'action' | 'end';
  title: string;
  description?: string;
  goal_description?: string;
  possible_outcomes?: string[];
  calendar_ids?: string[];
  position_x: number;
  position_y: number;
  config?: any;
  actions?: any[];
}

interface WorkflowConnection {
  id?: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type?: 'standard' | 'conditional' | 'goal_achieved' | 'goal_not_achieved';
  condition?: any;
  label?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const workflowId = params.workflowId;

    // Verify workflow ownership
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get all nodes for this workflow
    const { data: nodes, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });

    if (nodesError) {
      console.error('Error fetching nodes:', nodesError);
      return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
    }

    // Get all connections for this workflow
    const { data: connections, error: connectionsError } = await supabase
      .from('workflow_connections')
      .select('*')
      .eq('workflow_id', workflowId);

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ 
      nodes: nodes || [],
      connections: connections || []
    });

  } catch (error) {
    console.error('Error in workflow nodes GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const workflowId = params.workflowId;
    const data = await request.json();

    // Verify workflow ownership
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Handle batch operations for nodes and connections
    if (data.nodes && data.connections) {
      // This is a full workflow update
      const results = {
        nodes: { created: 0, updated: 0, errors: [] as any[] },
        connections: { created: 0, updated: 0, deleted: 0, errors: [] as any[] }
      };

      // Process nodes
      for (const node of data.nodes) {
        if (!node.node_id || !node.node_type || !node.title) {
          results.nodes.errors.push({ node, error: 'Missing required fields' });
          continue;
        }

        // Check if node exists
        const { data: existing } = await supabase
          .from('workflow_nodes')
          .select('id')
          .eq('workflow_id', workflowId)
          .eq('node_id', node.node_id)
          .single();

        const nodeData: WorkflowNode = {
          workflow_id: workflowId,
          node_id: node.node_id,
          node_type: node.node_type,
          title: node.title,
          description: node.description || null,
          goal_description: node.goal_description || null,
          possible_outcomes: node.possible_outcomes || [],
          calendar_ids: node.calendar_ids || [],
          position_x: node.position_x || 0,
          position_y: node.position_y || 0,
          config: node.config || {},
          actions: node.actions || []
        };

        if (existing) {
          // Update
          const { error } = await supabase
            .from('workflow_nodes')
            .update(nodeData)
            .eq('id', existing.id);

          if (error) {
            results.nodes.errors.push({ node, error: error.message });
          } else {
            results.nodes.updated++;
          }
        } else {
          // Create
          const { error } = await supabase
            .from('workflow_nodes')
            .insert([nodeData]);

          if (error) {
            results.nodes.errors.push({ node, error: error.message });
          } else {
            results.nodes.created++;
          }
        }
      }

      // Delete connections not in the update
      const connectionIds = data.connections
        .map((c: any) => `${c.source_node_id}-${c.target_node_id}-${c.connection_type || 'standard'}`)
        .filter(Boolean);

      // Get existing connections
      const { data: existingConnections } = await supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_id', workflowId);

      // Delete connections not in the update
      for (const existing of existingConnections || []) {
        const existingId = `${existing.source_node_id}-${existing.target_node_id}-${existing.connection_type}`;
        if (!connectionIds.includes(existingId)) {
          await supabase
            .from('workflow_connections')
            .delete()
            .eq('id', existing.id);
          results.connections.deleted++;
        }
      }

      // Process connections
      for (const conn of data.connections) {
        if (!conn.source_node_id || !conn.target_node_id) {
          results.connections.errors.push({ conn, error: 'Missing required fields' });
          continue;
        }

        // Check if connection exists
        const { data: existing } = await supabase
          .from('workflow_connections')
          .select('id')
          .eq('workflow_id', workflowId)
          .eq('source_node_id', conn.source_node_id)
          .eq('target_node_id', conn.target_node_id)
          .eq('connection_type', conn.connection_type || 'standard')
          .single();

        const connectionData: WorkflowConnection = {
          workflow_id: workflowId,
          source_node_id: conn.source_node_id,
          target_node_id: conn.target_node_id,
          connection_type: conn.connection_type || 'standard',
          condition: conn.condition || {},
          label: conn.label || null
        };

        if (existing) {
          // Update
          const { error } = await supabase
            .from('workflow_connections')
            .update(connectionData)
            .eq('id', existing.id);

          if (error) {
            results.connections.errors.push({ conn, error: error.message });
          } else {
            results.connections.updated++;
          }
        } else {
          // Create
          const { error } = await supabase
            .from('workflow_connections')
            .insert([connectionData]);

          if (error) {
            results.connections.errors.push({ conn, error: error.message });
          } else {
            results.connections.created++;
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Workflow updated',
        results 
      });

    } else if (data.node_id) {
      // Single node creation
      if (!data.node_type || !data.title) {
        return NextResponse.json({ 
          error: 'Node ID, type, and title are required' 
        }, { status: 400 });
      }

      // Check if node already exists
      const { data: existing } = await supabase
        .from('workflow_nodes')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('node_id', data.node_id)
        .single();

      if (existing) {
        return NextResponse.json({ 
          error: 'A node with this ID already exists' 
        }, { status: 400 });
      }

      const nodeData: WorkflowNode = {
        workflow_id: workflowId,
        node_id: data.node_id,
        node_type: data.node_type,
        title: data.title,
        description: data.description || null,
        goal_description: data.goal_description || null,
        possible_outcomes: data.possible_outcomes || [],
        calendar_ids: data.calendar_ids || [],
        position_x: data.position_x || 0,
        position_y: data.position_y || 0,
        config: data.config || {},
        actions: data.actions || []
      };

      const { data: node, error } = await supabase
        .from('workflow_nodes')
        .insert([nodeData])
        .select()
        .single();

      if (error) {
        console.error('Error creating node:', error);
        return NextResponse.json({ error: 'Failed to create node' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Node created',
        node 
      });
    } else {
      return NextResponse.json({ 
        error: 'Invalid request format' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in workflow nodes POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const workflowId = params.workflowId;
    const data = await request.json();

    // Verify workflow ownership
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (!data.node_id) {
      return NextResponse.json({ 
        error: 'Node ID is required' 
      }, { status: 400 });
    }

    // Update node
    const { data: node, error } = await supabase
      .from('workflow_nodes')
      .update({
        title: data.title,
        description: data.description,
        goal_description: data.goal_description,
        possible_outcomes: data.possible_outcomes,
        calendar_ids: data.calendar_ids,
        position_x: data.position_x,
        position_y: data.position_y,
        config: data.config,
        actions: data.actions
      })
      .eq('workflow_id', workflowId)
      .eq('node_id', data.node_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating node:', error);
      return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Node updated',
      node 
    });

  } catch (error) {
    console.error('Error in workflow nodes PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const workflowId = params.workflowId;
    
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('node_id');

    if (!nodeId) {
      return NextResponse.json({ 
        error: 'Node ID is required' 
      }, { status: 400 });
    }

    // Verify workflow ownership
    const { data: workflow, error: workflowError } = await supabase
      .from('chatbot_workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Delete node (connections will cascade delete)
    const { error } = await supabase
      .from('workflow_nodes')
      .delete()
      .eq('workflow_id', workflowId)
      .eq('node_id', nodeId);

    if (error) {
      console.error('Error deleting node:', error);
      return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Node deleted successfully' 
    });

  } catch (error) {
    console.error('Error in workflow nodes DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}