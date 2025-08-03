import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, requireAuthWithOrg } from '@/lib/auth/production-auth-server';

// GET: Get bot context
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ botId: string }> }
) {
  try {
    const params = await context.params;
    const { userId, organization } = await requireAuthWithOrg(request);
    const supabase = getServiceSupabase();
    
    const organizationId = organization?.organizationId || organization?.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // First verify the bot belongs to this organization
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', params.botId)
      .eq('organization_id', organizationId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Get the bot context
    const { data: botContext, error } = await supabase
      .from('bot_contexts')
      .select('*')
      .eq('bot_id', params.botId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching bot context:', error);
      return NextResponse.json({ error: 'Failed to fetch bot context' }, { status: 500 });
    }

    return NextResponse.json({ context: botContext });
  } catch (error) {
    console.error('Error in GET /api/bots/[botId]/context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST/PUT: Create or update bot context
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ botId: string }> }
) {
  try {
    const params = await context.params;
    const { userId, organization } = await requireAuthWithOrg(request);
    const supabase = getServiceSupabase();
    
    const organizationId = organization?.organizationId || organization?.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify the bot belongs to this organization
    const { data: bot } = await supabase
      .from('bots')
      .select('id, name')
      .eq('id', params.botId)
      .eq('organization_id', organizationId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const body = await request.json();
    const contextData = {
      ...body,
      bot_id: params.botId,
      organization_id: organizationId,
      created_by: userId,
      // Default business_name to bot name if not provided
      business_name: body.business_name || bot.name
    };

    // Check if context already exists
    const { data: existing } = await supabase
      .from('bot_contexts')
      .select('id')
      .eq('bot_id', params.botId)
      .single();

    let result;
    if (existing) {
      // Update existing context
      const { data, error } = await supabase
        .from('bot_contexts')
        .update({
          ...contextData,
          updated_at: new Date().toISOString()
        })
        .eq('bot_id', params.botId)
        .select()
        .single();

      if (error) {
        console.error('Error updating bot context:', error);
        return NextResponse.json({ error: 'Failed to update bot context' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new context
      const { data, error } = await supabase
        .from('bot_contexts')
        .insert(contextData)
        .select()
        .single();

      if (error) {
        console.error('Error creating bot context:', error);
        return NextResponse.json({ error: 'Failed to create bot context' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ context: result });
  } catch (error) {
    console.error('Error in POST /api/bots/[botId]/context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete bot context
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ botId: string }> }
) {
  try {
    const params = await context.params;
    const { userId, organization } = await requireAuthWithOrg(request);
    const supabase = getServiceSupabase();
    
    const organizationId = organization?.organizationId || organization?.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify the bot belongs to this organization
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', params.botId)
      .eq('organization_id', organizationId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Delete the context
    const { error } = await supabase
      .from('bot_contexts')
      .delete()
      .eq('bot_id', params.botId);

    if (error) {
      console.error('Error deleting bot context:', error);
      return NextResponse.json({ error: 'Failed to delete bot context' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/bots/[botId]/context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}