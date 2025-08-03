import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';

// GET - Fetch unified commission view (both pipeline and sales commissions)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get active integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ commissions: [] });
    }

    // Fetch from the unified view
    const { data: commissions, error } = await supabase
      .from('unified_commissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching unified commissions:', error);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('unified_commissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting unified commissions:', countError);
    }

    // Calculate summary stats
    const totalAmount = commissions?.reduce((sum, comm) => sum + (comm.commission_amount || 0), 0) || 0;
    const pipelineCount = commissions?.filter(c => c.sale_type === 'pipeline').length || 0;
    const recurringCount = commissions?.filter(c => c.sale_type === 'recurring').length || 0;
    const oneTimeCount = commissions?.filter(c => c.sale_type === 'one_time').length || 0;

    return NextResponse.json({ 
      commissions: commissions || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      },
      stats: {
        totalCommissions: commissions?.length || 0,
        totalAmount,
        pipelineCount,
        recurringCount,
        oneTimeCount
      }
    });
  } catch (error) {
    console.error('Error in GET /api/commissions/unified:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}