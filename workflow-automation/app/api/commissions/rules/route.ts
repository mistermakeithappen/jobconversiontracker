import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }
    const supabase = getServiceSupabase();
    
    // Get active integration for organization
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ rules: [] });
    }

    // Fetch all commission rules for this organization
    const { data: rules, error } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission rules:', error);
      return NextResponse.json({ error: 'Failed to fetch commission rules' }, { status: 500 });
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    console.error('Error in GET /api/commissions/rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }
    const supabase = getServiceSupabase();
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['ghl_user_id', 'user_name', 'user_email', 'commission_type'];
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

    // Check if rule already exists for this GHL user
    const { data: existingRule } = await supabase
      .from('commission_rules')
      .select('id')
      .eq('integration_id', integration.id)
      .eq('ghl_user_id', body.ghl_user_id)
      .single();

    if (existingRule) {
      return NextResponse.json({ error: 'Commission rule already exists for this user' }, { status: 400 });
    }

    // Create the commission rule
    const { data: rule, error } = await supabase
      .from('commission_rules')
      .insert({
        user_id: userId,
        integration_id: integration.id,
        ghl_user_id: body.ghl_user_id,
        user_name: body.user_name,
        user_email: body.user_email,
        user_phone: body.user_phone,
        commission_type: body.commission_type,
        commission_percentage: body.commission_percentage,
        base_commission: body.base_commission,
        commission_tiers: body.commission_tiers,
        applies_to: body.applies_to || 'all',
        applicable_product_ids: body.applicable_product_ids,
        mrr_commission_type: body.mrr_commission_type || 'all_payments',
        mrr_duration_months: body.mrr_duration_months,
        mrr_trailing_months: body.mrr_trailing_months,
        mrr_percentage_override: body.mrr_percentage_override,
        is_active: body.is_active !== false,
        priority: body.priority || 100,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date,
        notes: body.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating commission rule:', error);
      return NextResponse.json({ error: 'Failed to create commission rule' }, { status: 500 });
    }

    // Log the change
    await supabase
      .from('commission_rule_history')
      .insert({
        commission_rule_id: rule.id,
        changed_by: userId,
        change_type: 'created',
        new_values: rule,
        change_reason: 'Initial creation'
      });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error in POST /api/commissions/rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });
    }

    // Get the existing rule
    const { data: existingRule } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('id', body.id)
      .eq('user_id', userId)
      .single();

    if (!existingRule) {
      return NextResponse.json({ error: 'Commission rule not found' }, { status: 404 });
    }

    // Update the rule
    const updateData: any = {};
    const updateableFields = [
      'user_name', 'user_email', 'user_phone', 'commission_type', 
      'commission_percentage', 'base_commission', 'commission_tiers',
      'applies_to', 'applicable_product_ids', 'mrr_commission_type',
      'mrr_duration_months', 'mrr_trailing_months', 'mrr_percentage_override',
      'is_active', 'priority', 'effective_date', 'expiration_date', 'notes'
    ];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: rule, error } = await supabase
      .from('commission_rules')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating commission rule:', error);
      return NextResponse.json({ error: 'Failed to update commission rule' }, { status: 500 });
    }

    // Log the change
    await supabase
      .from('commission_rule_history')
      .insert({
        commission_rule_id: rule.id,
        changed_by: userId,
        change_type: 'updated',
        previous_values: existingRule,
        new_values: rule,
        change_reason: body.change_reason || 'Manual update'
      });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error in PUT /api/commissions/rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });
    }

    // Get the existing rule
    const { data: existingRule } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', userId)
      .single();

    if (!existingRule) {
      return NextResponse.json({ error: 'Commission rule not found' }, { status: 404 });
    }

    // Log the deletion
    await supabase
      .from('commission_rule_history')
      .insert({
        commission_rule_id: ruleId,
        changed_by: userId,
        change_type: 'deactivated',
        previous_values: existingRule,
        change_reason: 'Manual deletion'
      });

    // Delete the rule
    const { error } = await supabase
      .from('commission_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting commission rule:', error);
      return NextResponse.json({ error: 'Failed to delete commission rule' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/commissions/rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}