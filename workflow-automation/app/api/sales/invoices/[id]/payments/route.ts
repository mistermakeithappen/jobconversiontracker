import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';

export async function POST(
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
    const invoiceId = resolvedParams.id;
    const data = await request.json();
    
    // Validate required fields
    if (!data.amount || !data.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, payment_method' },
        { status: 400 }
      );
    }

    // Validate amount
    const paymentAmount = parseFloat(data.amount);
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // First, verify the invoice exists and belongs to this organization
    const { data: invoice, error: invoiceError } = await supabase
      .from('ghl_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if payment would exceed invoice amount
    const remainingBalance = invoice.amount - invoice.amount_paid;
    if (paymentAmount > remainingBalance) {
      return NextResponse.json(
        { error: `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingBalance})` },
        { status: 400 }
      );
    }

    // Call the payment recording function
    const { data: result, error: paymentError } = await supabase
      .rpc('record_invoice_payment', {
        p_invoice_id: invoiceId,
        p_amount: paymentAmount,
        p_payment_method: data.payment_method,
        p_payment_date: data.payment_date || new Date().toISOString(),
        p_transaction_id: data.transaction_id || null,
        p_notes: data.notes || null
      });

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
      return NextResponse.json(
        { error: 'Failed to record payment', details: paymentError.message },
        { status: 500 }
      );
    }

    // Get updated invoice data
    const { data: updatedInvoice, error: fetchError } = await supabase
      .from('ghl_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated invoice:', fetchError);
      return NextResponse.json(
        { error: 'Payment recorded but failed to fetch updated data' },
        { status: 500 }
      );
    }

    // TODO: Here you might want to trigger pipeline movement if configured
    // and the invoice is now fully paid

    return NextResponse.json({
      success: true,
      payment: {
        amount: paymentAmount,
        payment_method: data.payment_method,
        payment_date: data.payment_date || new Date().toISOString(),
        transaction_id: data.transaction_id,
        notes: data.notes
      },
      invoice: {
        id: updatedInvoice.id,
        amount: updatedInvoice.amount,
        amount_paid: updatedInvoice.amount_paid,
        remaining_balance: updatedInvoice.remaining_balance,
        status: updatedInvoice.status,
        payment_count: updatedInvoice.payment_history?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in payment recording:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const invoiceId = resolvedParams.id;
    const supabase = getServiceSupabase();

    // Get invoice with payment history
    const { data: invoice, error: invoiceError } = await supabase
      .from('ghl_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('organization_id', organization.organizationId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Format payment history
    const paymentHistory = (invoice.payment_history || []).map((payment: any) => ({
      id: payment.id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      transaction_id: payment.transaction_id,
      notes: payment.notes,
      recorded_at: payment.recorded_at,
      voided: payment.voided || false,
      voided_at: payment.voided_at,
      void_reason: payment.void_reason
    }));

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        amount_paid: invoice.amount_paid,
        remaining_balance: invoice.remaining_balance,
        status: invoice.status,
        currency: invoice.currency
      },
      payments: paymentHistory,
      summary: {
        total_payments: paymentHistory.filter((p: any) => !p.voided).length,
        total_amount_paid: invoice.amount_paid,
        remaining_balance: invoice.remaining_balance
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
