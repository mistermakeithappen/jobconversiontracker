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

    // Get all invoices for this opportunity and their payment totals
    const { data: invoices, error: invoicesError } = await supabase
      .from('ghl_invoices')
      .select('id, amount, amount_paid, status, invoice_number, name, created_at')
      .eq('organization_id', organization.organizationId)
      .eq('opportunity_id', opportunityId);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      // Don't fail completely - opportunity might not have invoices
    }

    // Get payment events from commission_events (webhook payments) - handle missing table gracefully
    let paymentEvents = [];
    try {
      const { data: events, error: paymentsError } = await supabase
        .from('commission_events')
        .select('event_amount, event_date, event_data, currency')
        .eq('organization_id', organization.organizationId)
        .eq('opportunity_id', opportunityId)
        .in('event_type', ['payment_collected', 'invoice_paid']);

      if (paymentsError) {
        if (paymentsError.code === 'PGRST205') {
          // Table doesn't exist, that's okay - use empty array
          // Only log this occasionally to reduce noise
          if (Math.random() < 0.1) { // Log ~10% of the time
            console.log('Commission events table not found, using invoice payments only');
          }
          paymentEvents = [];
        } else {
          console.error('Error fetching payment events:', paymentsError);
          paymentEvents = [];
        }
      } else {
        paymentEvents = events || [];
      }
    } catch (error) {
      console.error('Error accessing commission_events table:', error);
      paymentEvents = [];
    }

    // Calculate totals
    const invoicePayments = (invoices || []).reduce((total, invoice) => total + (invoice.amount_paid || 0), 0);
    const webhookPayments = paymentEvents.reduce((total, event) => total + (event.event_amount || 0), 0);
    
    // Avoid double counting - webhook payments might be included in invoice payments
    // For now, use the higher of the two values (better safe than sorry)
    const totalCashCollected = Math.max(invoicePayments, webhookPayments);

    // Get invoice breakdown
    const invoiceBreakdown = (invoices || []).map(invoice => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      name: invoice.name,
      amount: invoice.amount,
      amount_paid: invoice.amount_paid,
      remaining: invoice.amount - (invoice.amount_paid || 0),
      status: invoice.status,
      created_at: invoice.created_at,
      payment_percentage: invoice.amount > 0 ? ((invoice.amount_paid || 0) / invoice.amount) * 100 : 0
    }));

    // Get payment events breakdown
    const paymentBreakdown = paymentEvents.map(event => ({
      amount: event.event_amount,
      date: event.event_date,
      method: event.event_data?.payment_method || 'Unknown',
      source: event.event_data?.invoice_number || 'Direct Payment',
      currency: event.currency || 'USD'
    }));

    return NextResponse.json({
      success: true,
      cash_collected: {
        total: totalCashCollected,
        invoice_payments: invoicePayments,
        webhook_payments: webhookPayments,
        currency: 'USD'
      },
      invoices: {
        total_count: invoices?.length || 0,
        total_amount: (invoices || []).reduce((total, inv) => total + inv.amount, 0),
        total_paid: invoicePayments,
        breakdown: invoiceBreakdown
      },
      payments: {
        total_count: paymentEvents.length,
        breakdown: paymentBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching cash collected:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
