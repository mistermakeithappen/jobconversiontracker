import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const opportunityId = resolvedParams.id;
    const supabase = getServiceSupabase();

    // Get all estimates for this opportunity
    const { data: estimates, error: estimatesError } = await supabase
      .from('ghl_estimates')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    if (estimatesError) {
      console.error('Error fetching estimates:', estimatesError);
      return NextResponse.json(
        { error: 'Failed to fetch estimates', details: estimatesError.message },
        { status: 500 }
      );
    }

    // Format estimates for display
    const formattedEstimates = (estimates || []).map(estimate => ({
      id: estimate.id,
      estimate_number: estimate.estimate_number,
      ghl_estimate_id: estimate.ghl_estimate_id,
      name: estimate.name,
      description: estimate.description,
      amount: estimate.amount,
      currency: estimate.currency,
      status: estimate.status,
      created_date: estimate.created_date,
      sent_date: estimate.sent_date,
      viewed_date: estimate.viewed_date,
      response_date: estimate.response_date,
      expiry_date: estimate.expiry_date,
      converted_to_invoice: estimate.converted_to_invoice,
      converted_invoice_id: estimate.converted_invoice_id,
      line_items: estimate.line_items,
      terms: estimate.terms,
      notes: estimate.notes,
      created_at: estimate.created_at,
      updated_at: estimate.updated_at
    }));

    // Calculate summary
    const summary = {
      total_count: formattedEstimates.length,
      total_amount: formattedEstimates.reduce((sum, est) => sum + est.amount, 0),
      by_status: {
        draft: formattedEstimates.filter(e => e.status === 'draft').length,
        sent: formattedEstimates.filter(e => e.status === 'sent').length,
        viewed: formattedEstimates.filter(e => e.status === 'viewed').length,
        accepted: formattedEstimates.filter(e => e.status === 'accepted').length,
        declined: formattedEstimates.filter(e => e.status === 'declined').length,
        expired: formattedEstimates.filter(e => e.status === 'expired').length,
        cancelled: formattedEstimates.filter(e => e.status === 'cancelled').length,
        converted: formattedEstimates.filter(e => e.converted_to_invoice).length
      },
      latest_estimate: formattedEstimates[0] || null
    };

    return NextResponse.json({
      success: true,
      estimates: formattedEstimates,
      summary
    });

  } catch (error) {
    console.error('Error fetching opportunity estimates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
