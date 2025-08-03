import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
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
    
    const supabase = getServiceSupabase();
    
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
    
    // Get products for the organization
    const { data: products, error } = await supabase
      .from('ghl_products')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      products: products || []
    });

  } catch (error) {
    console.error('Products error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { name, description, price, ghl_product_id, is_active = true } = body;
    
    if (!name || !ghl_product_id) {
      return NextResponse.json(
        { error: 'Name and GHL Product ID are required' },
        { status: 400 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (!integration) {
      return NextResponse.json(
        { error: 'No active GoHighLevel integration found' },
        { status: 404 }
      );
    }
    
    // Create the product
    const { data: product, error } = await supabase
      .from('ghl_products')
      .insert({
        organization_id: organization.organizationId,
        integration_id: integration.id,
        ghl_product_id,
        name,
        description,
        price: price || 0,
        is_active
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return NextResponse.json(
        { error: 'Failed to create product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      product
    });

  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Update the product
    const { data: product, error } = await supabase
      .from('ghl_products')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organization.organizationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      product
    });

  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Delete the product
    const { error } = await supabase
      .from('ghl_products')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.organizationId);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json(
        { error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}