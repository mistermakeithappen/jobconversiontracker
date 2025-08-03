import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { AdvancedWorkflowEngine } from '@/lib/chatbot/advanced-workflow-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { message, session_id } = await request.json();
    const botId = params.botId;

    if (!message || !session_id) {
      return NextResponse.json(
        { error: 'Message and session_id are required' },
        { status: 400 }
      );
    }

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    if (!bot.is_active) {
      return NextResponse.json(
        { error: 'Bot is not active' },
        { status: 400 }
      );
    }

    // Get or create session
    let session;
    const { data: existingSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('bot_id', botId)
      .single();

    if (existingSession) {
      session = existingSession;
    } else {
      // Create new session
      const { data: newSession, error: createError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: session_id,
          bot_id: botId,
          user_id: userId,
          session_variables: {},
          conversation_history: []
        }])
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        );
      }
      session = newSession;
    }

    // Get bot workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('bot_workflows')
      .select('*')
      .eq('bot_id', botId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (workflowError || !workflow) {
      // No workflow, use simple response
      const response = `I'm ${bot.name}. ${bot.description || 'How can I help you today?'}`;
      
      // Update conversation history
      const updatedHistory = [
        ...(session.conversation_history || []),
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: response, timestamp: new Date().toISOString() }
      ];

      await supabase
        .from('chat_sessions')
        .update({ 
          conversation_history: updatedHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id);

      return NextResponse.json({
        response,
        session_id,
        session: { ...session, conversation_history: updatedHistory }
      });
    }

    // Process message through workflow engine
    const engine = new AdvancedWorkflowEngine(supabase);
    const result = await engine.processMessage({
      message,
      sessionId: session_id,
      botId,
      workflowId: workflow.id,
      userId
    });

    return NextResponse.json({
      response: result.response,
      session_id,
      session: result.session,
      actions_performed: result.actionsPerformed,
      current_node: result.currentNode
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}