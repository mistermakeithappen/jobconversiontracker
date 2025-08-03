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

    let query = supabase
      .from('commission_events')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('event_source', 'invoice')
      .order('event_date', { ascending: false });

    // Note: commission_events table doesn't have integration_id column
    // We'll filter by checking event_data.integration_id if needed
    if (integrationId) {
      // For now, we'll fetch all and filter in memory
      console.log('Note: Filtering by integration_id will be done in memory');
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('event_date', startDate);
    }
    if (endDate) {
      query = query.lte('event_date', endDate);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Transform commission events to invoice format
    let filteredEvents = events || [];
    
    // Get all unique contact IDs
    const contactIds = [...new Set(filteredEvents
      .map(event => event.contact_id)
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
    
    // Filter by integration_id if provided
    if (integrationId) {
      filteredEvents = filteredEvents.filter(event => 
        event.event_data?.integration_id === integrationId
      );
    }
    
    const invoices = filteredEvents.map(event => {
      const contact = contactsMap.get(event.contact_id);
      return {
        id: event.id,
        invoice_id: event.invoice_id,
        invoice_number: event.event_data?.invoice_number || 'N/A',
        invoice_date: event.event_date,
        opportunity_id: event.opportunity_id,
        contact_id: event.contact_id,
        contact_name: contact ? 
          (contact.first_name || contact.last_name ? 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
            contact.full_name) : 
          null,
        contact_email: contact?.email || null,
        amount: event.event_amount,
        amount_paid: event.event_data?.amount_paid || 0,
        amount_due: event.event_data?.amount_due || 0,
        status: event.event_data?.status || 'unknown',
        currency: event.currency,
        due_date: event.event_data?.due_date,
        sent_date: event.event_data?.sent_date,
        notes: event.event_data?.notes,
        event_type: event.event_type
      };
    }) || [];

    // Calculate summary statistics
    const stats = {
      totalInvoices: invoices?.length || 0,
      totalAmount: invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
      totalPaid: invoices?.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
      totalDue: invoices?.filter(i => i.status !== 'paid' && i.status !== 'void').reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
      byStatus: {
        draft: invoices?.filter(i => i.status === 'draft').length || 0,
        sent: invoices?.filter(i => i.status === 'sent').length || 0,
        viewed: invoices?.filter(i => i.status === 'viewed').length || 0,
        paid: invoices?.filter(i => i.status === 'paid').length || 0,
        partially_paid: invoices?.filter(i => i.status === 'partially_paid').length || 0,
        overdue: invoices?.filter(i => i.status === 'overdue').length || 0,
        void: invoices?.filter(i => i.status === 'void').length || 0
      }
    };

    return NextResponse.json({
      invoices: invoices || [],
      stats
    });

  } catch (error) {
    console.error('Error in GET /api/sales/invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}