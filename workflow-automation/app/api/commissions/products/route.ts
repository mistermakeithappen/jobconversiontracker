import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    
    let query = supabase
      .from('commission_product_rules')
      .select(`
        *,
        product:ghl_products(*)
      `)
      .eq('organization_id', organization.organizationId)
      .eq('is_active', true);
    
    if (productId) {
      query = query.eq('product_id', productId);
    }
    
    const { data: rules, error } = await query.order('priority', { ascending: false });
    
    if (error) {
      console.error('Error fetching product commission rules:', error);
      return NextResponse.json({ error: 'Failed to fetch product commission rules' }, { status: 500 });
    }
    
    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    console.error('Error in GET /api/commissions/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    const {
      productId,
      initialSaleRate,
      renewalRate,
      mrrCommissionType,
      mrrDurationMonths,
      trailingMonths,
      clawbackEnabled,
      clawbackPeriodDays,
      clawbackPercentage,
      minSaleAmount,
      maxCommissionAmount,
      requiresManagerApproval,
      approvalThreshold,
      maxCommissionOfMargin,
      estimatedMarginPercentage,
      priority,
      effectiveDate,
      expiryDate
    } = body;
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }
    
    // Check if rule already exists for this product
    const { data: existingRule } = await supabase
      .from('commission_product_rules')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .single();
    
    if (existingRule) {
      return NextResponse.json({ 
        error: 'Active commission rule already exists for this product. Please deactivate it first.' 
      }, { status: 409 });
    }
    
    // Create new rule
    const { data: rule, error } = await supabase
      .from('commission_product_rules')
      .insert({
        organization_id: organization.organizationId,
        product_id: productId,
        initial_sale_rate: initialSaleRate || 10,
        renewal_rate: renewalRate || 5,
        mrr_commission_type: mrrCommissionType || 'duration',
        mrr_duration_months: mrrDurationMonths || 12,
        trailing_months: trailingMonths || 6,
        clawback_enabled: clawbackEnabled || false,
        clawback_period_days: clawbackPeriodDays || 90,
        clawback_percentage: clawbackPercentage || 100,
        min_sale_amount: minSaleAmount,
        max_commission_amount: maxCommissionAmount,
        requires_manager_approval: requiresManagerApproval || false,
        approval_threshold: approvalThreshold,
        max_commission_of_margin: maxCommissionOfMargin || 50,
        estimated_margin_percentage: estimatedMarginPercentage,
        priority: priority || 100,
        effective_date: effectiveDate || new Date().toISOString().split('T')[0],
        expiry_date: expiryDate,
        created_by: userId
      })
      .select(`
        *,
        product:ghl_products(*)
      `)
      .single();
    
    if (error) {
      console.error('Error creating product commission rule:', error);
      return NextResponse.json({ error: 'Failed to create product commission rule' }, { status: 500 });
    }
    
    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error in POST /api/commissions/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }
    
    // Verify ownership
    const { data: existingRule } = await supabase
      .from('commission_product_rules')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!existingRule) {
      return NextResponse.json({ error: 'Commission rule not found' }, { status: 404 });
    }
    
    // Update rule
    const { data: rule, error } = await supabase
      .from('commission_product_rules')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        product:ghl_products(*)
      `)
      .single();
    
    if (error) {
      console.error('Error updating product commission rule:', error);
      return NextResponse.json({ error: 'Failed to update product commission rule' }, { status: 500 });
    }
    
    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error in PUT /api/commissions/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }
    
    // Verify ownership
    const { data: existingRule } = await supabase
      .from('commission_product_rules')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .single();
    
    if (!existingRule) {
      return NextResponse.json({ error: 'Commission rule not found' }, { status: 404 });
    }
    
    // Soft delete by deactivating
    const { error } = await supabase
      .from('commission_product_rules')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) {
      console.error('Error deactivating product commission rule:', error);
      return NextResponse.json({ error: 'Failed to deactivate product commission rule' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/commissions/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}