import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Get knowledge base entries
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('bot_knowledge_base')
      .select('*')
      .eq('bot_id', botId)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: knowledge, error } = await query.order('category', { ascending: true });

    if (error) {
      console.error('Error fetching knowledge base:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 });
    }

    // Group by category for easier consumption
    const groupedKnowledge = knowledge?.reduce((acc: any, item: any) => {
      if (!acc[item.category]) {
        acc[item.category] = {};
      }
      acc[item.category][item.key] = {
        value: item.value,
        metadata: item.metadata,
        id: item.id
      };
      return acc;
    }, {}) || {};

    return NextResponse.json({ 
      knowledge: groupedKnowledge,
      categories: Object.keys(groupedKnowledge),
      total_entries: knowledge?.length || 0
    });

  } catch (error) {
    console.error('Error in knowledge GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;
    const data = await request.json();

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Validate required fields
    if (!data.category || !data.key || !data.value) {
      return NextResponse.json({ 
        error: 'Category, key, and value are required' 
      }, { status: 400 });
    }

    // Check if entry already exists
    const { data: existing } = await supabase
      .from('bot_knowledge_base')
      .select('id')
      .eq('bot_id', botId)
      .eq('category', data.category)
      .eq('key', data.key)
      .single();

    if (existing) {
      // Update existing entry
      const { data: updated, error: updateError } = await supabase
        .from('bot_knowledge_base')
        .update({
          value: data.value,
          metadata: data.metadata || {},
          is_active: true
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating knowledge entry:', updateError);
        return NextResponse.json({ error: 'Failed to update knowledge entry' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Knowledge entry updated',
        entry: updated 
      });
    } else {
      // Create new entry
      const { data: created, error: createError } = await supabase
        .from('bot_knowledge_base')
        .insert([{
          bot_id: botId,
          category: data.category,
          key: data.key,
          value: data.value,
          metadata: data.metadata || {},
          is_active: true
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating knowledge entry:', createError);
        return NextResponse.json({ error: 'Failed to create knowledge entry' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Knowledge entry created',
        entry: created 
      });
    }

  } catch (error) {
    console.error('Error in knowledge POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;
    const data = await request.json();

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Batch update/import functionality
    if (data.entries && Array.isArray(data.entries)) {
      const results = {
        created: 0,
        updated: 0,
        errors: [] as any[]
      };

      for (const entry of data.entries) {
        if (!entry.category || !entry.key || !entry.value) {
          results.errors.push({ entry, error: 'Missing required fields' });
          continue;
        }

        // Check if exists
        const { data: existing } = await supabase
          .from('bot_knowledge_base')
          .select('id')
          .eq('bot_id', botId)
          .eq('category', entry.category)
          .eq('key', entry.key)
          .single();

        if (existing) {
          // Update
          const { error } = await supabase
            .from('bot_knowledge_base')
            .update({
              value: entry.value,
              metadata: entry.metadata || {},
              is_active: true
            })
            .eq('id', existing.id);

          if (error) {
            results.errors.push({ entry, error: error.message });
          } else {
            results.updated++;
          }
        } else {
          // Create
          const { error } = await supabase
            .from('bot_knowledge_base')
            .insert([{
              bot_id: botId,
              category: entry.category,
              key: entry.key,
              value: entry.value,
              metadata: entry.metadata || {},
              is_active: true
            }]);

          if (error) {
            results.errors.push({ entry, error: error.message });
          } else {
            results.created++;
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Batch import completed',
        results 
      });
    } else {
      return NextResponse.json({ 
        error: 'Invalid request format. Expected { entries: [...] }' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in knowledge PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const botId = params.botId;
    
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('id');
    const category = searchParams.get('category');
    const key = searchParams.get('key');

    // Verify bot ownership
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('user_id', userId)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (entryId) {
      // Delete specific entry by ID
      const { error } = await supabase
        .from('bot_knowledge_base')
        .delete()
        .eq('id', entryId)
        .eq('bot_id', botId);

      if (error) {
        console.error('Error deleting knowledge entry:', error);
        return NextResponse.json({ error: 'Failed to delete knowledge entry' }, { status: 500 });
      }
    } else if (category && key) {
      // Delete by category and key
      const { error } = await supabase
        .from('bot_knowledge_base')
        .delete()
        .eq('bot_id', botId)
        .eq('category', category)
        .eq('key', key);

      if (error) {
        console.error('Error deleting knowledge entry:', error);
        return NextResponse.json({ error: 'Failed to delete knowledge entry' }, { status: 500 });
      }
    } else if (category) {
      // Delete entire category
      const { error } = await supabase
        .from('bot_knowledge_base')
        .delete()
        .eq('bot_id', botId)
        .eq('category', category);

      if (error) {
        console.error('Error deleting knowledge category:', error);
        return NextResponse.json({ error: 'Failed to delete knowledge category' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ 
        error: 'Entry ID or category/key combination required' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Knowledge entry deleted successfully' 
    });

  } catch (error) {
    console.error('Error in knowledge DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}