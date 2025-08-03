import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/products/sync - Starting product sync request');
    
    // Get user from production auth
    const { userId } = await requireAuth(request);
    
    console.log('User authenticated:', userId);
    
    // Get user's organization
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    
    // Get integration ID from request
    const { integrationId } = await request.json();
    
    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    // Get the integration with tokens
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('organization_id', organization.organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return NextResponse.json({ error: 'GoHighLevel integration not found or not active' }, { status: 404 });
    }

    if (!integration.config?.encryptedTokens) {
      return NextResponse.json({ error: 'GoHighLevel integration not properly connected' }, { status: 400 });
    }

    // Create GHL client with proper token refresh callback
    const { decrypt, encrypt } = await import('@/lib/utils/encryption');
    const mcpToken = integration.mcp_enabled && integration.mcp_token_encrypted ? 
      decrypt(integration.mcp_token_encrypted) : undefined;
    
    console.log('Integration config:', JSON.stringify(integration.config, null, 2));
    console.log('Decrypted tokens available:', !!integration.config.encryptedTokens);
      
    const ghlClient = await createGHLClient(
      integration.config.encryptedTokens,
      async (newTokens) => {
        const encryptedTokens = encrypt(JSON.stringify(newTokens));
        await supabase
          .from('integrations')
          .update({
            config: {
              ...integration.config,
              encryptedTokens,
              lastTokenRefresh: new Date().toISOString()
            }
          })
          .eq('id', integration.id);
      },
      mcpToken
    );

    // Fetch all products from GoHighLevel
    console.log('Starting product sync from GoHighLevel...');
    console.log('Location ID:', integration.config?.locationId || 'No location ID found');
    
    const result = await ghlClient.getAllProducts();
    
    if (result.error) {
      console.error('Error fetching products:', result.error);
      
      // Check if this is an authorization error
      if (result.error.includes('Unauthorized') || result.error.includes('401')) {
        return NextResponse.json({ 
          error: 'GoHighLevel authorization failed. Your token may be missing the required products.readonly scope. Please reconnect your GoHighLevel integration.',
          requiresReauth: true 
        }, { status: 401 });
      }
      
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const products = result.products || [];
    console.log(`Fetched ${products.length} products from GoHighLevel`);
    console.log('Raw result from GoHighLevel:', JSON.stringify(result, null, 2));

    // Fetch prices for each product separately
    console.log('Fetching prices for products...');
    const productsWithPrices = await Promise.all(
      products.map(async (product: any) => {
        try {
          const priceResult = await ghlClient.getProductPrices(product._id || product.id);
          console.log(`Prices for ${product.name}:`, JSON.stringify(priceResult, null, 2));
          return {
            ...product,
            fetchedPrices: priceResult.prices || priceResult.data || priceResult || []
          };
        } catch (error) {
          console.error(`Failed to fetch prices for product ${product._id}:`, error);
          return product;
        }
      })
    );

    // Prepare products for upsert
    const productsToUpsert = productsWithPrices.map((product: any) => {
      console.log('Processing product:', JSON.stringify(product, null, 2));
      
      // Parse price information with extensive checks
      let price = null;
      let priceType = 'one_time';
      let recurringInterval = null;
      let recurringIntervalCount = 1;
      
      // Debug logging for price structure
      console.log(`Product ${product.name} price fields:`, {
        price: product.price,
        prices: product.prices,
        fetchedPrices: product.fetchedPrices,
        amount: product.amount,
        priceAmount: product.priceAmount,
        price_amount: product.price_amount,
        defaultPrice: product.defaultPrice,
        unitAmount: product.unitAmount,
        unit_amount: product.unit_amount,
        variants: product.variants
      });
      
      // Check various price locations in order of preference
      // 0. Check separately fetched prices first
      if (product.fetchedPrices && Array.isArray(product.fetchedPrices) && product.fetchedPrices.length > 0) {
        const firstPrice = product.fetchedPrices[0];
        // Handle both amount and unit_amount
        price = firstPrice.amount || firstPrice.unit_amount || firstPrice.unitAmount || firstPrice.price;
        if (price && typeof price === 'string') price = parseFloat(price);
        
        if (firstPrice.type === 'recurring' || firstPrice.recurring || firstPrice.interval) {
          priceType = 'recurring';
          recurringInterval = firstPrice.recurring?.interval || firstPrice.interval || 'month';
          recurringIntervalCount = firstPrice.recurring?.interval_count || firstPrice.intervalCount || firstPrice.interval_count || 1;
        }
      }
      // 1. Check prices array (standard GHL structure)
      else if (product.prices && Array.isArray(product.prices) && product.prices.length > 0) {
        const firstPrice = product.prices[0];
        // Handle both amount and unit_amount
        price = firstPrice.amount || firstPrice.unit_amount || firstPrice.unitAmount;
        if (price && typeof price === 'string') price = parseFloat(price);
        
        if (firstPrice.type === 'recurring' || firstPrice.recurring) {
          priceType = 'recurring';
          recurringInterval = firstPrice.recurring?.interval || firstPrice.interval || 'month';
          recurringIntervalCount = firstPrice.recurring?.interval_count || firstPrice.intervalCount || 1;
        }
      }
      // 2. Check direct price field
      else if (product.price !== undefined && product.price !== null) {
        if (typeof product.price === 'object') {
          price = product.price.amount || product.price.unit_amount || product.price.unitAmount;
        } else {
          price = product.price;
        }
        if (typeof price === 'string') price = parseFloat(price);
      }
      // 3. Check amount field
      else if (product.amount !== undefined && product.amount !== null) {
        price = typeof product.amount === 'string' ? parseFloat(product.amount) : product.amount;
      }
      // 4. Check defaultPrice
      else if (product.defaultPrice !== undefined && product.defaultPrice !== null) {
        if (typeof product.defaultPrice === 'object') {
          price = product.defaultPrice.amount || product.defaultPrice.unit_amount;
        } else {
          price = product.defaultPrice;
        }
        if (typeof price === 'string') price = parseFloat(price);
      }
      // 5. Check variants (some products have pricing in variants)
      else if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        if (firstVariant.price !== undefined) {
          price = typeof firstVariant.price === 'string' ? parseFloat(firstVariant.price) : firstVariant.price;
        }
      }
      
      // If still no price, try to extract from name or description
      if (!price && (product.name || product.description)) {
        // Look for price patterns in name and description
        const textToSearch = `${product.name || ''} ${product.description || ''}`;
        
        // Match patterns like $200, $500.00, etc.
        const priceMatch = textToSearch.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, ''));
          console.log(`Extracted price $${price} from text for ${product.name}`);
        }
        
        // Also check for specific service patterns
        if (!price) {
          if (product.name?.toLowerCase().includes('service minimum')) price = 200;
          else if (product.name?.toLowerCase().includes('half day')) price = 500;
          else if (product.name?.toLowerCase().includes('full day')) price = 900;
          else if (product.name?.includes('OG $550')) price = 550;
        }
      }
      
      // Handle price in cents (convert to dollars if needed)
      if (price && price > 10000) {
        console.log(`Price ${price} appears to be in cents, converting to dollars`);
        price = price / 100;
      }
      
      // Check for recurring information at product level
      if (product.recurring || product.type === 'recurring' || product.billingCycle) {
        priceType = 'recurring';
        if (product.recurring) {
          recurringInterval = product.recurring.interval || 'month';
          recurringIntervalCount = product.recurring.interval_count || 1;
        } else if (product.billingCycle) {
          recurringInterval = product.billingCycle;
        }
      }
      
      console.log(`Parsed price for ${product.name}:`, {
        price,
        priceType,
        recurringInterval,
        recurringIntervalCount
      });

      return {
        organization_id: integration.organization_id,
        integration_id: integrationId,
        ghl_product_id: product._id || product.id, // Handle both _id and id
        name: product.name || 'Unnamed Product',
        description: product.description || null,
        price: price, // Price should already be in correct format from GHL
        price_type: priceType,
        recurring_interval: recurringInterval,
        recurring_interval_count: recurringIntervalCount,
        currency: product.currency || 'USD',
        is_active: product.active !== false && product.availableInStore !== false,
        metadata: {
          ...product,
          prices: product.prices || [],
          variants: product.variants || []
        },
        synced_at: new Date().toISOString()
      };
    });

    // Upsert products to database
    if (productsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('ghl_products')
        .upsert(productsToUpsert, {
          onConflict: 'integration_id,ghl_product_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Error upserting products:', upsertError);
        return NextResponse.json({ error: 'Failed to save products' }, { status: 500 });
      }
    }

    // Mark inactive products that weren't in the sync
    const syncedProductIds = products.map((p: any) => p._id || p.id);
    
    if (syncedProductIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('ghl_products')
        .update({ is_active: false })
        .eq('integration_id', integrationId)
        .not('ghl_product_id', 'in', `(${syncedProductIds.join(',')})`);

      if (deactivateError) {
        console.error('Error deactivating old products:', deactivateError);
      }
    }

    // Return success even if no products found
    return NextResponse.json({
      success: true,
      message: productsToUpsert.length > 0 
        ? `Successfully synced ${productsToUpsert.length} products`
        : 'No products found in GoHighLevel. Please ensure you have products created in your GoHighLevel account.',
      stats: {
        total: result.total || products.length,
        synced: productsToUpsert.length,
        requestCount: result.requestCount || 1
      }
    });

  } catch (error) {
    console.error('Product sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch synced products
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    
    // Get user's organization
    const organization = await getUserOrganization(userId);
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    
    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }

    // Fetch products from database
    const { data: products, error } = await supabase
      .from('ghl_products')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('integration_id', integrationId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: products || [] });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}