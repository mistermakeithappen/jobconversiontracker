import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { AdvancedWorkflowEngine } from '@/lib/chatbot/advanced-workflow-engine';

// Store engine instances per user to avoid re-initialization
const engineCache = new Map<string, AdvancedWorkflowEngine>();

export async function POST(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;
    
    const { 
      message, 
      contactId, 
      sessionId,
      metadata = {} 
    } = await request.json();

    // Validate input
    if (!message?.trim()) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 });
    }

    if (!contactId) {
      return NextResponse.json({ 
        error: 'Contact ID is required' 
      }, { status: 400 });
    }

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, user_id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ 
        error: 'Bot not found' 
      }, { status: 404 });
    }

    // Get or create workflow engine for this user
    let engine = engineCache.get(userId);
    if (!engine) {
      engine = new AdvancedWorkflowEngine();
      await engine.initialize(userId);
      engineCache.set(userId, engine);
    }

    // Process the message
    const result = await engine.processBotMessage(
      botId,
      contactId,
      message,
      sessionId
    );

    // Log the interaction for analytics
    await logChatInteraction(supabase, {
      botId,
      contactId,
      sessionId: result.sessionId,
      userMessage: message,
      botResponse: result.response,
      metadata
    });

    return NextResponse.json({
      response: result.response,
      sessionId: result.sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in bot chat:', error);
    return NextResponse.json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Get chat history for a bot and contact
export async function GET(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;
    
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ 
        error: 'Bot not found' 
      }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('conversation_messages')
      .select(`
        *,
        conversation_sessions!inner (
          id,
          bot_id,
          ghl_contact_id,
          workflow_id,
          is_active,
          started_at,
          ended_at
        )
      `)
      .eq('conversation_sessions.bot_id', botId);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (contactId) {
      query = query.eq('conversation_sessions.ghl_contact_id', contactId);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: messages, error, count } = await query;

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch chat history' 
      }, { status: 500 });
    }

    // Group messages by session
    const sessions = messages?.reduce((acc: any, msg: any) => {
      const sessionId = msg.session_id;
      if (!acc[sessionId]) {
        acc[sessionId] = {
          sessionId,
          workflowId: msg.conversation_sessions.workflow_id,
          isActive: msg.conversation_sessions.is_active,
          startedAt: msg.conversation_sessions.started_at,
          endedAt: msg.conversation_sessions.ended_at,
          messages: []
        };
      }
      
      acc[sessionId].messages.push({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        timestamp: msg.created_at,
        nodeId: msg.checkpoint_key
      });
      
      return acc;
    }, {}) || {};

    return NextResponse.json({
      sessions: Object.values(sessions),
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Error in chat history GET:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch chat history' 
    }, { status: 500 });
  }
}

// Helper function to log chat interactions
async function logChatInteraction(
  supabase: any,
  data: {
    botId: string;
    contactId: string;
    sessionId: string;
    userMessage: string;
    botResponse: string;
    metadata: any;
  }
) {
  try {
    // This could be extended to log to a separate analytics table
    // For now, the messages are already logged in the workflow engine
    console.log('Chat interaction:', {
      botId: data.botId,
      contactId: data.contactId,
      sessionId: data.sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging chat interaction:', error);
  }
}

// Cleanup old engine instances periodically
setInterval(() => {
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  
  for (const [userId, engine] of engineCache.entries()) {
    // In a real implementation, we'd track last used time
    // For now, just clear the cache periodically
    engineCache.delete(userId);
  }
}, 60 * 60 * 1000); // Every hour