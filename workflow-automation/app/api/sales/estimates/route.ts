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
    const { searchParams } = new URL(request.url);
    
    const integrationId = searchParams.get('integrationId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const contactId = searchParams.get('contactId');
    const opportunityId = searchParams.get('opportunityId');

    // Query from ghl_estimates table
    let query = supabase
      .from('ghl_estimates')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .order('created_date', { ascending: false, nullsFirst: false });

    // Apply filters
    if (integrationId) {
      query = query.eq('integration_id', integrationId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('created_date', startDate);
    }
    if (endDate) {
      query = query.lte('created_date', endDate);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }

    const { data: ghlEstimates, error } = await query;

    if (error) {
      console.error('Error fetching estimates:', error);
      return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
    }

    // Get all unique contact IDs
    const contactIds = [...new Set(ghlEstimates
      ?.map(estimate => estimate.contact_id)
      .filter(id => id))] as string[];
    
    // Fetch contact information if we have contact IDs
    let contactsMap = new Map();
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('ghl_contact_id, first_name, last_name, email, full_name')
        .eq('organization_id', organization.organizationId)
        .in('ghl_contact_id', contactIds);
      
      if (contacts) {
        contacts.forEach(contact => {
          contactsMap.set(contact.ghl_contact_id, contact);
        });
      }
    }
    
    // Transform estimates to frontend format
    const estimates = (ghlEstimates || []).map(estimate => {
      const contact = contactsMap.get(estimate.contact_id);
      return {
        id: estimate.id,
        estimate_id: estimate.ghl_estimate_id,
        estimate_number: estimate.estimate_number || 'N/A',
        estimate_date: estimate.created_date,
        opportunity_id: estimate.opportunity_id,
        contact_id: estimate.contact_id,
        contact_name: contact ? 
          (contact.first_name || contact.last_name ? 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
            contact.full_name) : 
          null,
        contact_email: contact?.email || null,
        amount: parseFloat(estimate.amount),
        status: estimate.status,
        currency: estimate.currency,
        valid_until: estimate.expiry_date,
        sent_date: estimate.sent_date,
        notes: estimate.notes,
        event_type: `estimate_${estimate.status}`, // for compatibility
        // Additional fields needed for invoice conversion
        name: estimate.name || 'Estimate',
        description: estimate.description || '',
        line_items: estimate.line_items || [],
        terms: estimate.terms || 'Net 30',
        property_id: estimate.property_id,
        property_address: estimate.property_address,
        applied_tax_rate: estimate.applied_tax_rate,
        metadata: estimate.metadata || {},
        converted_to_invoice: estimate.converted_to_invoice || false
      };
    });

    // Calculate summary statistics
    const stats = {
      totalEstimates: estimates?.length || 0,
      totalAmount: estimates?.reduce((sum, est) => sum + (est.amount || 0), 0) || 0,
      totalAccepted: estimates?.filter(e => e.status === 'accepted').reduce((sum, est) => sum + (est.amount || 0), 0) || 0,
      totalPending: estimates?.filter(e => e.status !== 'accepted' && e.status !== 'declined' && e.status !== 'expired').reduce((sum, est) => sum + (est.amount || 0), 0) || 0,
      byStatus: {
        draft: estimates?.filter(e => e.status === 'draft').length || 0,
        sent: estimates?.filter(e => e.status === 'sent').length || 0,
        accepted: estimates?.filter(e => e.status === 'accepted').length || 0,
        declined: estimates?.filter(e => e.status === 'declined').length || 0,
        expired: estimates?.filter(e => e.status === 'expired').length || 0
      }
    };

    return NextResponse.json({
      estimates: estimates || [],
      stats
    });

  } catch (error) {
    console.error('Error in GET /api/sales/estimates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}