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

    // Get all invoices for this opportunity
    const { data: invoices, error: invoicesError } = await supabase
      .from('ghl_invoices')
      .select('*')
      .eq('organization_id', organization.organizationId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json(
        { error: 'Failed to fetch invoices', details: invoicesError.message },
        { status: 500 }
      );
    }

    // Format invoices for display
    const formattedInvoices = (invoices || []).map(invoice => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      ghl_invoice_id: invoice.ghl_invoice_id,
      name: invoice.name,
      description: invoice.description,
      amount: invoice.amount,
      amount_paid: invoice.amount_paid,
      remaining_balance: invoice.amount - (invoice.amount_paid || 0),
      currency: invoice.currency,
      status: invoice.status,
      created_date: invoice.created_date,
      sent_date: invoice.sent_date,
      due_date: invoice.due_date,
      paid_date: invoice.paid_date,
      estimate_id: invoice.estimate_id,
      line_items: invoice.line_items,
      payment_terms: invoice.payment_terms,
      notes: invoice.notes,
      payment_history: invoice.payment_history || [],
      last_payment_date: invoice.last_payment_date,
      last_payment_method: invoice.last_payment_method,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      
      // Calculated fields
      payment_percentage: invoice.amount > 0 ? ((invoice.amount_paid || 0) / invoice.amount) * 100 : 0,
      is_overdue: invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid'
    }));

    // Calculate summary
    const summary = {
      total_count: formattedInvoices.length,
      total_amount: formattedInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      total_paid: formattedInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0),
      total_outstanding: formattedInvoices.reduce((sum, inv) => sum + inv.remaining_balance, 0),
      by_status: {
        draft: formattedInvoices.filter(i => i.status === 'draft').length,
        sent: formattedInvoices.filter(i => i.status === 'sent').length,
        viewed: formattedInvoices.filter(i => i.status === 'viewed').length,
        paid: formattedInvoices.filter(i => i.status === 'paid').length,
        partially_paid: formattedInvoices.filter(i => i.status === 'partially_paid').length,
        overdue: formattedInvoices.filter(i => i.is_overdue).length,
        void: formattedInvoices.filter(i => i.status === 'void').length,
        cancelled: formattedInvoices.filter(i => i.status === 'cancelled').length
      },
      latest_invoice: formattedInvoices[0] || null,
      payment_summary: {
        total_payments: formattedInvoices.reduce((sum, inv) => sum + (inv.payment_history?.length || 0), 0),
        avg_payment_time: null, // Could calculate this later
        fastest_payment: null,  // Could calculate this later
      }
    };

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
      summary
    });

  } catch (error) {
    console.error('Error fetching opportunity invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
