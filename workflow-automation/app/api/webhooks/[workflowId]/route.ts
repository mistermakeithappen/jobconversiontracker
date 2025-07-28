import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WorkflowExecutionEngine } from '@/lib/workflow-execution/execution-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: { workflowId: string } }
) {
  try {
    const workflowId = params.workflowId;
    const body = await request.json();
    
    // Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('is_active', true)
      .single();
      
    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found or inactive' },
        { status: 404 }
      );
    }
    
    // Check if workflow has a webhook trigger
    const nodes = workflow.definition.nodes || [];
    const webhookTrigger = nodes.find((node: any) => 
      node.data.integration === 'Webhook' || 
      (node.data.integration === 'GoHighLevel' && node.data.moduleType === 'trigger')
    );
    
    if (!webhookTrigger) {
      return NextResponse.json(
        { error: 'Workflow does not have a webhook trigger' },
        { status: 400 }
      );
    }
    
    // Initialize execution engine
    const engine = new WorkflowExecutionEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Execute workflow with webhook data
    const executionId = await engine.executeWorkflow(
      workflowId,
      workflow.user_id,
      {
        trigger: 'webhook',
        webhookData: body,
        headers: Object.fromEntries(request.headers.entries())
      }
    );
    
    return NextResponse.json({
      success: true,
      executionId,
      message: 'Webhook received and workflow triggered'
    });
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Support GET for webhook verification
export async function GET(
  request: Request,
  { params }: { params: { workflowId: string } }
) {
  return NextResponse.json({
    success: true,
    workflowId: params.workflowId,
    message: 'Webhook endpoint is active'
  });
}