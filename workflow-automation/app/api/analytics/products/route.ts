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
    const dateRange = searchParams.get('dateRange') || '30days';
    const groupBy = searchParams.get('groupBy') || 'product';
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    // Fetch sales transactions with products
    let transactionsQuery = supabase
      .from('sales_transactions')
      .select(`
        *,
        product:ghl_products(*),
        team_member:team_members(*)
      `)
      .eq('organization_id', organization.organizationId)
      .eq('payment_status', 'completed')
      .gte('payment_date', startDate.toISOString())
      .lte('payment_date', endDate.toISOString());
    
    if (productId) {
      transactionsQuery = transactionsQuery.eq('product_id', productId);
    }
    
    const { data: transactions, error: transError } = await transactionsQuery;
    
    if (transError) {
      console.error('Error fetching transactions:', transError);
      return NextResponse.json({ error: 'Failed to fetch transaction data' }, { status: 500 });
    }
    
    // Fetch commission data
    const { data: commissions, error: commError } = await supabase
      .from('commission_records')
      .select(`
        *,
        event:commission_events!event_id(
          product_id,
          event_date
        )
      `)
      .eq('organization_id', organization.organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (commError) {
      console.error('Error fetching commissions:', commError);
    }
    
    // Analyze data by product
    const productAnalytics: Map<string, any> = new Map();
    const salesPersonAnalytics: Map<string, any> = new Map();
    
    // Process transactions
    transactions?.forEach(transaction => {
      if (!transaction.product_id) return;
      
      const productKey = transaction.product_id;
      const salesPersonKey = transaction.team_member_id || 'unassigned';
      
      // Product analytics
      if (!productAnalytics.has(productKey)) {
        productAnalytics.set(productKey, {
          product: transaction.product,
          unitsSold: 0,
          totalRevenue: 0,
          transactions: [],
          uniqueCustomers: new Set(),
          averageSalePrice: 0,
          commissionsPaid: 0,
          topSalesPeople: new Map()
        });
      }
      
      const productData = productAnalytics.get(productKey);
      productData.unitsSold += 1;
      productData.totalRevenue += transaction.amount;
      productData.transactions.push(transaction);
      productData.uniqueCustomers.add(transaction.contact_id);
      
      // Track top salespeople for this product
      if (transaction.team_member_id) {
        const salesCount = productData.topSalesPeople.get(transaction.team_member_id) || 0;
        productData.topSalesPeople.set(transaction.team_member_id, {
          count: salesCount + 1,
          revenue: (productData.topSalesPeople.get(transaction.team_member_id)?.revenue || 0) + transaction.amount,
          member: transaction.team_member
        });
      }
      
      // Salesperson analytics
      if (transaction.team_member_id) {
        if (!salesPersonAnalytics.has(salesPersonKey)) {
          salesPersonAnalytics.set(salesPersonKey, {
            member: transaction.team_member,
            productsSold: new Map(),
            totalRevenue: 0,
            totalUnits: 0,
            commissionEarned: 0
          });
        }
        
        const salesData = salesPersonAnalytics.get(salesPersonKey);
        salesData.totalRevenue += transaction.amount;
        salesData.totalUnits += 1;
        
        const productCount = salesData.productsSold.get(productKey) || { count: 0, revenue: 0, product: transaction.product };
        productCount.count += 1;
        productCount.revenue += transaction.amount;
        salesData.productsSold.set(productKey, productCount);
      }
    });
    
    // Process commissions
    commissions?.forEach(commission => {
      if (!commission.event?.product_id) return;
      
      const productKey = commission.event.product_id;
      const salesPersonKey = commission.team_member_id || 'unassigned';
      
      if (productAnalytics.has(productKey)) {
        const productData = productAnalytics.get(productKey);
        productData.commissionsPaid += commission.commission_amount;
      }
      
      if (salesPersonAnalytics.has(salesPersonKey)) {
        const salesData = salesPersonAnalytics.get(salesPersonKey);
        salesData.commissionEarned += commission.commission_amount;
      }
    });
    
    // Calculate final metrics
    const productResults = Array.from(productAnalytics.entries()).map(([productId, data]) => {
      const topSalesPeople = Array.from(data.topSalesPeople.entries())
        .map(([memberId, info]) => ({
          memberId,
          ...info
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      return {
        productId,
        product: data.product,
        unitsSold: data.unitsSold,
        totalRevenue: data.totalRevenue,
        averageSalePrice: data.unitsSold > 0 ? data.totalRevenue / data.unitsSold : 0,
        uniqueCustomers: data.uniqueCustomers.size,
        commissionsPaid: data.commissionsPaid,
        commissionRate: data.totalRevenue > 0 ? (data.commissionsPaid / data.totalRevenue) * 100 : 0,
        topSalesPeople,
        // Calculate sales velocity (units per day)
        salesVelocity: data.unitsSold / Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    const salesPersonResults = Array.from(salesPersonAnalytics.entries()).map(([memberId, data]) => {
      const productBreakdown = Array.from(data.productsSold.entries())
        .map(([productId, info]) => ({
          productId,
          ...info
        }))
        .sort((a, b) => b.revenue - a.revenue);
      
      return {
        memberId,
        member: data.member,
        totalRevenue: data.totalRevenue,
        totalUnits: data.totalUnits,
        commissionEarned: data.commissionEarned,
        commissionRate: data.totalRevenue > 0 ? (data.commissionEarned / data.totalRevenue) * 100 : 0,
        productBreakdown,
        uniqueProducts: data.productsSold.size,
        averageOrderValue: data.totalUnits > 0 ? data.totalRevenue / data.totalUnits : 0
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    // Time series data for charts
    const timeSeriesData = generateTimeSeriesData(transactions || [], startDate, endDate, dateRange);
    
    // Summary statistics
    const summary = {
      totalRevenue: productResults.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalUnits: productResults.reduce((sum, p) => sum + p.unitsSold, 0),
      totalCommissions: productResults.reduce((sum, p) => sum + p.commissionsPaid, 0),
      uniqueProducts: productResults.filter(p => p.unitsSold > 0).length,
      topProduct: productResults[0],
      topSalesPerson: salesPersonResults[0],
      averageCommissionRate: 0
    };
    
    if (summary.totalRevenue > 0) {
      summary.averageCommissionRate = (summary.totalCommissions / summary.totalRevenue) * 100;
    }
    
    return NextResponse.json({
      summary,
      products: productResults,
      salesPeople: groupBy === 'salesperson' ? salesPersonResults : undefined,
      timeSeries: timeSeriesData,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Generate time series data for charts
function generateTimeSeriesData(
  transactions: any[], 
  startDate: Date, 
  endDate: Date, 
  dateRange: string
) {
  const interval = dateRange === '7days' ? 'day' : 
                  dateRange === '30days' ? 'day' : 
                  dateRange === '90days' ? 'week' : 'month';
  
  const timeSeries: Map<string, any> = new Map();
  
  // Initialize time buckets
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = getTimeKey(current, interval);
    timeSeries.set(key, {
      date: key,
      revenue: 0,
      units: 0,
      transactions: 0
    });
    
    // Increment date
    if (interval === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (interval === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  // Aggregate transactions
  transactions.forEach(transaction => {
    const date = new Date(transaction.payment_date);
    const key = getTimeKey(date, interval);
    
    if (timeSeries.has(key)) {
      const bucket = timeSeries.get(key);
      bucket.revenue += transaction.amount;
      bucket.units += 1;
      bucket.transactions += 1;
    }
  });
  
  return Array.from(timeSeries.values());
}

function getTimeKey(date: Date, interval: string): string {
  if (interval === 'day') {
    return date.toISOString().split('T')[0];
  } else if (interval === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toISOString().split('T')[0];
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Create or update product analytics snapshot
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    const { snapshotDate, periodType } = body;
    
    if (!snapshotDate || !periodType) {
      return NextResponse.json({ 
        error: 'Missing required fields: snapshotDate, periodType' 
      }, { status: 400 });
    }
    
    // Calculate period boundaries
    const date = new Date(snapshotDate);
    let startDate: Date;
    let endDate: Date;
    
    if (periodType === 'daily') {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    } else if (periodType === 'weekly') {
      startDate = new Date(date);
      startDate.setDate(date.getDate() - date.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Fetch all products
    const { data: products } = await supabase
      .from('ghl_products')
      .select('id')
      .eq('organization_id', organization.organizationId);
    
    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No products found' }, { status: 200 });
    }
    
    // Process each product
    const snapshots = [];
    
    for (const product of products) {
      // Fetch transactions for this product in the period
      const { data: transactions } = await supabase
        .from('sales_transactions')
        .select('*')
        .eq('organization_id', organization.organizationId)
        .eq('product_id', product.id)
        .eq('payment_status', 'completed')
        .gte('payment_date', startDate.toISOString())
        .lte('payment_date', endDate.toISOString());
      
      if (!transactions || transactions.length === 0) continue;
      
      // Calculate metrics
      const metrics = {
        units_sold: transactions.length,
        total_revenue: transactions.reduce((sum, t) => sum + t.amount, 0),
        avg_sale_price: 0,
        top_performers: new Map()
      };
      
      metrics.avg_sale_price = metrics.units_sold > 0 
        ? metrics.total_revenue / metrics.units_sold 
        : 0;
      
      // Track top performers
      transactions.forEach(t => {
        if (t.team_member_id) {
          const current = metrics.top_performers.get(t.team_member_id) || { units: 0, revenue: 0 };
          current.units += 1;
          current.revenue += t.amount;
          metrics.top_performers.set(t.team_member_id, current);
        }
      });
      
      const topPerformers = Array.from(metrics.top_performers.entries())
        .map(([id, data]) => ({ team_member_id: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      // Upsert snapshot
      const { error } = await supabase
        .from('product_analytics_snapshots')
        .upsert({
          organization_id: organization.organizationId,
          product_id: product.id,
          snapshot_date: snapshotDate,
          period_type: periodType,
          units_sold: metrics.units_sold,
          total_revenue: metrics.total_revenue,
          avg_sale_price: metrics.avg_sale_price,
          top_performers: topPerformers
        }, {
          onConflict: 'organization_id,product_id,snapshot_date,period_type'
        });
      
      if (!error) {
        snapshots.push({
          product_id: product.id,
          metrics
        });
      }
    }
    
    return NextResponse.json({ 
      message: `Created ${snapshots.length} product analytics snapshots`,
      snapshots 
    });
  } catch (error) {
    console.error('Error in POST /api/analytics/products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}