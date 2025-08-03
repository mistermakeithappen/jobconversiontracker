import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    const supabase = getServiceSupabase();
    
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch all commission assignments for the organization
    const { data: assignments, error } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission assignments:', error);
      return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
    }

    // Enrich with opportunity data manually
    const enrichedAssignments = await Promise.all(
      (assignments || []).map(async (assignment) => {
        let opportunityInfo = {
          opportunity_name: null,
          opportunity_value: null,
          contact_name: null
        };
        
        if (assignment.opportunity_id) {
          const { data: opp } = await supabase
            .from('opportunity_cache')
            .select('title, monetary_value, contact_name')
            .eq('opportunity_id', assignment.opportunity_id)
            .eq('organization_id', organization.organizationId)
            .single();
          
          if (opp) {
            opportunityInfo = {
              opportunity_name: opp.title,
              opportunity_value: opp.monetary_value,
              contact_name: opp.contact_name
            };
          }
        }
        
        // Calculate commission amount based on type and rate
        const commission_amount = assignment.commission_type === 'percentage_profit' || assignment.commission_type === 'percentage_gross'
          ? (opportunityInfo.opportunity_value || 0) * (assignment.base_rate / 100)
          : assignment.base_rate; // Fixed amount
        
        return {
          ...assignment,
          ...opportunityInfo,
          commission_amount,
          // Add default values for payment tracking fields if they don't exist
          is_paid: assignment.is_paid || false,
          paid_date: assignment.paid_date || null,
          paid_amount: assignment.paid_amount || null,
          payment_reference: assignment.payment_reference || null
        };
      })
    );

    return NextResponse.json({ 
      assignments: enrichedAssignments,
      total: enrichedAssignments.length 
    });

  } catch (error) {
    console.error('Error in commissions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}