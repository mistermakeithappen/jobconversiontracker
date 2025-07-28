import { NextResponse } from 'next/server';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';
import { WorkflowExecutionEngine } from '@/lib/workflow-execution/execution-engine';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = mockAuthServer();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const body = await request.json();
    const workflowId = params.id;
    
    // Initialize execution engine
    const engine = new WorkflowExecutionEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Execute workflow
    const executionId = await engine.executeWorkflow(
      workflowId,
      userId,
      body.inputData
    );
    
    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow execution started'
    });
    
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}