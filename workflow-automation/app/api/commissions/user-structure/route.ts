import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

// GET - Fetch user's commission structure
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ structure: null, message: 'No active GoHighLevel integration found' });
    }

    // Fetch user's commission structure
    const { data: structure, error } = await supabase
      .from('user_commission_structures')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching commission structure:', error);
      return NextResponse.json({ error: 'Failed to fetch commission structure' }, { status: 500 });
    }

    return NextResponse.json({ 
      structure: structure || null,
      integrationId: integration.id 
    });
  } catch (error) {
    console.error('Error in GET /api/commissions/user-structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create user's commission structure
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['commission_type'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active GoHighLevel integration found' }, { status: 400 });
    }

    // Check if structure already exists
    const { data: existingStructure } = await supabase
      .from('user_commission_structures')
      .select('id')
      .eq('user_id', userId)
      .eq('integration_id', integration.id)
      .single();

    if (existingStructure) {
      return NextResponse.json({ error: 'Commission structure already exists. Use PUT to update.' }, { status: 400 });
    }

    // Create the commission structure
    const { data: structure, error } = await supabase
      .from('user_commission_structures')
      .insert({
        user_id: userId,
        integration_id: integration.id,
        commission_type: body.commission_type,
        commission_percentage: body.commission_percentage,
        base_commission: body.base_commission,
        commission_tiers: body.commission_tiers,
        applies_to: body.applies_to || 'all',
        applicable_product_ids: body.applicable_product_ids,
        mrr_commission_type: body.mrr_commission_type || 'all_payments',
        mrr_duration_months: body.mrr_duration_months || 12,
        mrr_trailing_months: body.mrr_trailing_months || 3,
        mrr_percentage_override: body.mrr_percentage_override,
        is_active: true,
        effective_date: body.effective_date || new Date().toISOString().split('T')[0],
        notes: body.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating commission structure:', error);
      return NextResponse.json({ error: 'Failed to create commission structure' }, { status: 500 });
    }

    return NextResponse.json({ structure });
  } catch (error) {
    console.error('Error in POST /api/commissions/user-structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update user's commission structure
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active GoHighLevel integration found' }, { status: 400 });
    }

    // Get the existing structure
    const { data: existingStructure } = await supabase
      .from('user_commission_structures')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integration.id)
      .single();

    if (!existingStructure) {
      return NextResponse.json({ error: 'Commission structure not found' }, { status: 404 });
    }

    // Update the structure
    const updateData: any = {};
    const updateableFields = [
      'commission_type', 'commission_percentage', 'base_commission', 'commission_tiers',
      'applies_to', 'applicable_product_ids', 'mrr_commission_type',
      'mrr_duration_months', 'mrr_trailing_months', 'mrr_percentage_override',
      'is_active', 'effective_date', 'notes'
    ];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: structure, error } = await supabase
      .from('user_commission_structures')
      .update(updateData)
      .eq('user_id', userId)
      .eq('integration_id', integration.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating commission structure:', error);
      return NextResponse.json({ error: 'Failed to update commission structure' }, { status: 500 });
    }

    return NextResponse.json({ structure });
  } catch (error) {
    console.error('Error in PUT /api/commissions/user-structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deactivate user's commission structure
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();

    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active GoHighLevel integration found' }, { status: 400 });
    }

    // Deactivate the structure instead of deleting
    const { error } = await supabase
      .from('user_commission_structures')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('integration_id', integration.id);

    if (error) {
      console.error('Error deactivating commission structure:', error);
      return NextResponse.json({ error: 'Failed to deactivate commission structure' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/commissions/user-structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}