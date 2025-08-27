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

    // Try to query from ghl_invoices table first, fall back to empty array if not exists
    let query = supabase
      .from('ghl_invoices')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .order('created_at', { ascending: false });

    if (integrationId) {
      query = query.eq('integration_id', integrationId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('invoice_date', startDate);
    }
    if (endDate) {
      query = query.lte('invoice_date', endDate);
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
      // If table doesn't exist, return empty results instead of error
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        console.log('Invoices table not found, returning empty results');
        return NextResponse.json({
          invoices: [],
          stats: {
            totalInvoices: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalDue: 0,
            byStatus: {
              draft: 0, sent: 0, viewed: 0, paid: 0, partially_paid: 0, overdue: 0, void: 0
            }
          }
        });
      }
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Transform invoice data
    let filteredInvoices = events || [];
    
    // Get all unique contact IDs
    const contactIds = [...new Set(filteredInvoices
      .map(invoice => invoice.contact_id)
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
    
    const invoices = filteredInvoices.map(invoice => {
      const contact = contactsMap.get(invoice.contact_id);
      return {
        id: invoice.id,
        invoice_id: invoice.ghl_invoice_id || invoice.invoice_id,
        invoice_number: invoice.invoice_number || 'N/A',
        invoice_date: invoice.invoice_date || invoice.created_at,
        opportunity_id: invoice.opportunity_id,
        contact_id: invoice.contact_id,
        contact_name: contact ? 
          (contact.first_name || contact.last_name ? 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
            contact.full_name) : 
          invoice.contact_name,
        contact_email: contact?.email || invoice.contact_email,
        amount: invoice.amount || 0,
        amount_paid: invoice.amount_paid || 0,
        amount_due: invoice.amount_due || (invoice.amount - (invoice.amount_paid || 0)),
        status: invoice.status || 'unknown',
        currency: invoice.currency || 'USD',
        due_date: invoice.due_date,
        sent_date: invoice.sent_date,
        notes: invoice.notes,
        event_type: 'invoice'
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