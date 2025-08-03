import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

// GET - Fetch opportunity commission overrides
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const opportunityId = searchParams.get('opportunityId');
    const ghlUserId = searchParams.get('ghlUserId');
    
    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ overrides: [] });
    }

    let query = supabase
      .from('opportunity_commission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_id', integration.id)
      .order('created_at', { ascending: false });

    // Filter by opportunity if specified
    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }

    // Filter by GHL user if specified
    if (ghlUserId) {
      query = query.eq('ghl_user_id', ghlUserId);
    }

    const { data: overrides, error } = await query;

    if (error) {
      console.error('Error fetching opportunity overrides:', error);
      return NextResponse.json({ error: 'Failed to fetch opportunity overrides' }, { status: 500 });
    }

    return NextResponse.json({ overrides: overrides || [] });
  } catch (error) {
    console.error('Error in GET /api/commissions/opportunity-overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create opportunity commission override
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['opportunity_id', 'ghl_user_id', 'commission_type', 'override_reason'];
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

    // Check if override already exists
    const { data: existingOverride } = await supabase
      .from('opportunity_commission_overrides')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('opportunity_id', body.opportunity_id)
      .eq('ghl_user_id', body.ghl_user_id)
      .single();

    if (existingOverride) {
      return NextResponse.json({ error: 'Commission override already exists for this opportunity and user' }, { status: 400 });
    }

    // Create the override
    const { data: override, error } = await supabase
      .from('opportunity_commission_overrides')
      .insert({
        user_id: userId,
        integration_id: integration.id,
        opportunity_id: body.opportunity_id,
        ghl_user_id: body.ghl_user_id,
        commission_type: body.commission_type,
        commission_percentage: body.commission_percentage,
        base_commission: body.base_commission,
        commission_tiers: body.commission_tiers,
        mrr_commission_type: body.mrr_commission_type,
        mrr_duration_months: body.mrr_duration_months,
        mrr_trailing_months: body.mrr_trailing_months,
        mrr_percentage_override: body.mrr_percentage_override,
        override_reason: body.override_reason,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating opportunity override:', error);
      return NextResponse.json({ error: 'Failed to create opportunity override' }, { status: 500 });
    }

    return NextResponse.json({ override });
  } catch (error) {
    console.error('Error in POST /api/commissions/opportunity-overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update opportunity commission override
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Missing override ID' }, { status: 400 });
    }

    // Get the existing override
    const { data: existingOverride } = await supabase
      .from('opportunity_commission_overrides')
      .select('*')
      .eq('id', body.id)
      .eq('user_id', userId)
      .single();

    if (!existingOverride) {
      return NextResponse.json({ error: 'Commission override not found' }, { status: 404 });
    }

    // Update the override
    const updateData: any = {};
    const updateableFields = [
      'commission_type', 'commission_percentage', 'base_commission', 'commission_tiers',
      'mrr_commission_type', 'mrr_duration_months', 'mrr_trailing_months', 
      'mrr_percentage_override', 'override_reason'
    ];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: override, error } = await supabase
      .from('opportunity_commission_overrides')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating opportunity override:', error);
      return NextResponse.json({ error: 'Failed to update opportunity override' }, { status: 500 });
    }

    return NextResponse.json({ override });
  } catch (error) {
    console.error('Error in PUT /api/commissions/opportunity-overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove opportunity commission override
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const overrideId = searchParams.get('id');

    if (!overrideId) {
      return NextResponse.json({ error: 'Missing override ID' }, { status: 400 });
    }

    // Delete the override
    const { error } = await supabase
      .from('opportunity_commission_overrides')
      .delete()
      .eq('id', overrideId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting opportunity override:', error);
      return NextResponse.json({ error: 'Failed to delete opportunity override' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/commissions/opportunity-overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}