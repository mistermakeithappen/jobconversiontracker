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
    const contactId = searchParams.get('contactId') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 1) {
      return NextResponse.json({ opportunities: [] });
    }

    const supabase = getServiceSupabase();

    let sqlQuery = supabase
      .from('opportunity_cache')
      .select(`
        id,
        opportunity_id,
        title,
        contact_id,
        contact_name,
        contact_email,
        contact_phone,
        stage,
        status,
        monetary_value,
        pipeline_name,
        assigned_to,
        created_at
      `)
      .eq('organization_id', organization.organizationId);

    // If searching by contact, filter by contact
    if (contactId) {
      sqlQuery = sqlQuery.eq('contact_id', contactId);
    }

    // Search by title, contact name, or opportunity ID
    sqlQuery = sqlQuery.or(
      `title.ilike.%${query}%,contact_name.ilike.%${query}%,opportunity_id.ilike.%${query}%`
    );

    const { data: opportunities, error } = await sqlQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching opportunities:', error);
      return NextResponse.json(
        { error: 'Failed to search opportunities' },
        { status: 500 }
      );
    }

    // Transform opportunities for frontend consumption
    const transformedOpportunities = opportunities.map(opp => ({
      id: opp.opportunity_id,
      internal_id: opp.id,
      title: opp.title,
      contact_id: opp.contact_id,
      contact_name: opp.contact_name,
      contact_email: opp.contact_email,
      contact_phone: opp.contact_phone,
      stage: opp.stage,
      status: opp.status,
      monetary_value: opp.monetary_value || 0,
      pipeline_name: opp.pipeline_name,
      assigned_to: opp.assigned_to,
      display_value: formatCurrency(opp.monetary_value || 0),
      created_at: opp.created_at
    }));

    return NextResponse.json({
      opportunities: transformedOpportunities,
      count: transformedOpportunities.length
    });

  } catch (error) {
    console.error('Opportunity search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
