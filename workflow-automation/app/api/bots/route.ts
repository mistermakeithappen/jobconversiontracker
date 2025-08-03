import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    
    if (botId) {
      // Get single bot
      const { data: bot, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('organization_id', organization.organizationId)
        .single();
        
      if (error) {
        console.error('Error fetching bot:', error);
        return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
      }
      
      return NextResponse.json(bot);
    } else {
      // Get all bots
      const { data: bots, error } = await supabase
        .from('bots')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bots:', error);
        return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 });
      }

      return NextResponse.json(bots || []);
    }

  } catch (error) {
    console.error('Error in bots GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const botData = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    // Validate required fields
    if (!botData.name) {
      return NextResponse.json({ 
        error: 'Bot name is required' 
      }, { status: 400 });
    }

    // Check if bot with this name already exists for this organization
    const { data: existingBot } = await supabase
      .from('bots')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('name', botData.name)
      .single();

    if (existingBot) {
      return NextResponse.json({ 
        error: 'A bot with this name already exists' 
      }, { status: 400 });
    }

    // Create the bot
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .insert([{
        organization_id: organization.organizationId,
        name: botData.name,
        description: botData.description || '',
        avatar_url: botData.avatar_url || null,
        global_context: botData.global_context || '',
        specific_context: botData.specific_context || '',
        knowledge_base: botData.knowledge_base || {},
        personality_config: botData.personality_config || {
          tone: 'professional',
          style: 'conversational',
          response_length: 'concise'
        },
        is_active: botData.is_active !== false
      }])
      .select()
      .single();

    if (botError) {
      console.error('Error creating bot:', botError);
      return NextResponse.json({ error: 'Failed to create bot' }, { status: 500 });
    }

    // If workflows are provided, link them to the bot
    if (botData.workflow_ids && Array.isArray(botData.workflow_ids)) {
      const botWorkflowLinks = botData.workflow_ids.map((workflowId: string, index: number) => ({
        bot_id: bot.id,
        workflow_id: workflowId,
        is_primary: index === 0, // First workflow is primary by default
        priority: index
      }));

      const { error: linkError } = await supabase
        .from('bot_workflows')
        .insert(botWorkflowLinks);

      if (linkError) {
        console.error('Error linking workflows to bot:', linkError);
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json(bot);

  } catch (error) {
    console.error('Error in bots POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const updateData = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Verify bot ownership
    const { data: existingBot, error: checkError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (checkError || !existingBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Update bot
    const { data: bot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', botId)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating bot:', error);
      return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bot updated successfully',
      bot 
    });

  } catch (error) {
    console.error('Error in bots PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { bot_id, ...updateData } = await request.json();
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    if (!bot_id) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Verify bot ownership
    const { data: existingBot, error: checkError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', bot_id)
      .eq('organization_id', organization.organizationId)
      .single();

    if (checkError || !existingBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Update bot
    const { data: bot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', bot_id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating bot:', error);
      return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bot updated successfully',
      bot 
    });

  } catch (error) {
    console.error('Error in bots PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { userId } = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Verify bot ownership and delete
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('organization_id', organization.organizationId);

    if (error) {
      console.error('Error deleting bot:', error);
      return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bot deleted successfully' 
    });

  } catch (error) {
    console.error('Error in bots DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}