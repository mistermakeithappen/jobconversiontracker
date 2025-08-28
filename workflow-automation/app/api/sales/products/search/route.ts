import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 1) {
      return NextResponse.json({ products: [] });
    }

    const supabase = getServiceSupabase();

    // Search products by name or description
    const { data: products, error } = await supabase
      .from('ghl_products')
      .select(`
        id,
        ghl_product_id,
        name,
        description,
        price,
        price_type,
        recurring_interval,
        recurring_interval_count,
        currency,
        is_active,
        metadata
      `)
      .eq('organization_id', organization.organizationId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name')
      .limit(limit);

    if (error) {
      console.error('Error searching products:', error);
      return NextResponse.json(
        { error: 'Failed to search products' },
        { status: 500 }
      );
    }

    // Transform products for frontend consumption
    const transformedProducts = products.map(product => ({
      id: product.id,
      ghl_product_id: product.ghl_product_id,
      name: product.name,
      description: product.description || '',
      price: product.price || 0,
      price_type: product.price_type || 'one_time',
      recurring_interval: product.recurring_interval,
      recurring_interval_count: product.recurring_interval_count || 1,
      currency: product.currency || 'USD',
      // Add display price for different types
      display_price: formatProductPrice(product),
      unit_label: getUnitLabel(product)
    }));

    return NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    });

  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatProductPrice(product: any): string {
  const price = product.price || 0;
  const currency = product.currency || 'USD';
  
  if (product.price_type === 'recurring') {
    const interval = product.recurring_interval || 'monthly';
    const count = product.recurring_interval_count || 1;
    const intervalText = count === 1 ? interval.slice(0, -2) : `${count} ${interval}`;
    return `$${price.toFixed(2)}/${intervalText}`;
  }
  
  return `$${price.toFixed(2)}`;
}

function getUnitLabel(product: any): string {
  if (product.price_type === 'recurring') {
    const interval = product.recurring_interval || 'monthly';
    const count = product.recurring_interval_count || 1;
    return count === 1 ? interval.slice(0, -2) : `${count} ${interval}`;
  }
  
  // Check metadata for unit label
  if (product.metadata && product.metadata.unit_label) {
    return product.metadata.unit_label;
  }
  
  return 'each';
}
