import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const payoutId = searchParams.get('payoutId');
    const format = searchParams.get('format') || 'json';
    
    if (!payoutId) {
      return NextResponse.json({ error: 'Payout ID required' }, { status: 400 });
    }

    // Get payout details
    const { data: payout, error: payoutError } = await supabase
      .from('commission_payouts')
      .select(`
        *,
        payout_line_items (
          *,
          commission_calculations (
            commission_type,
            commission_percentage,
            base_amount
          ),
          sales_transactions (
            payment_method,
            currency
          )
        )
      `)
      .eq('id', payoutId)
      .eq('user_id', user.id)
      .single();

    if (payoutError || !payout) {
      console.error('Payout not found:', payoutError);
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    // Format based on requested type
    if (format === 'csv') {
      return exportAsCSV(payout);
    } else if (format === 'pdf') {
      // PDF generation would require additional libraries
      return NextResponse.json({ 
        error: 'PDF export not yet implemented',
        suggestion: 'Use CSV format for now'
      }, { status: 501 });
    } else {
      // Default JSON format with detailed breakdown
      return NextResponse.json({
        payout: {
          id: payout.id,
          number: payout.payout_number,
          date: payout.payout_date,
          period: {
            start: payout.payout_period_start,
            end: payout.payout_period_end
          },
          recipient: {
            id: payout.ghl_user_id,
            name: payout.user_name,
            email: payout.user_email
          },
          payment: {
            method: payout.payment_method,
            status: payout.payment_status,
            reference: payout.payment_reference,
            paidAt: payout.paid_at
          },
          summary: {
            totalAmount: payout.total_amount,
            totalSales: payout.total_sales_amount,
            commissionCount: payout.commission_count,
            currency: payout.currency
          },
          lineItems: payout.payout_line_items.map((item: any) => ({
            id: item.id,
            opportunity: {
              id: item.opportunity_id,
              name: item.opportunity_name
            },
            contact: {
              id: item.contact_id,
              name: item.contact_name
            },
            product: item.product_name,
            saleDate: item.sale_date,
            saleAmount: item.sale_amount,
            commissionType: item.commission_calculations?.commission_type,
            commissionPercentage: item.commission_percentage,
            commissionAmount: item.commission_amount,
            transactionType: item.transaction_type
          }))
        }
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function exportAsCSV(payout: any): NextResponse {
  // Create CSV header
  const headers = [
    'Line Item ID',
    'Sale Date',
    'Opportunity ID',
    'Opportunity Name',
    'Contact ID',
    'Contact Name',
    'Product',
    'Sale Amount',
    'Commission Type',
    'Commission %',
    'Commission Amount',
    'Transaction Type'
  ];

  // Create CSV rows
  const rows = payout.payout_line_items.map((item: any) => [
    item.id,
    item.sale_date,
    item.opportunity_id,
    item.opportunity_name,
    item.contact_id,
    item.contact_name,
    item.product_name,
    item.sale_amount,
    item.commission_calculations?.commission_type || '',
    item.commission_percentage || '',
    item.commission_amount,
    item.transaction_type
  ]);

  // Add summary rows
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Payout Number', payout.payout_number]);
  rows.push(['Payout Date', payout.payout_date]);
  rows.push(['Period', `${payout.payout_period_start} to ${payout.payout_period_end}`]);
  rows.push(['Recipient', payout.user_name]);
  rows.push(['Email', payout.user_email]);
  rows.push(['Total Sales', payout.total_sales_amount]);
  rows.push(['Total Commission', payout.total_amount]);
  rows.push(['Payment Method', payout.payment_method]);
  rows.push(['Payment Status', payout.payment_status]);

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape values that contain commas or quotes
      const value = String(cell || '');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  // Return CSV response
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payout-${payout.payout_number}.csv"`
    }
  });
}

// POST endpoint to mark payout as paid
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { 
      payoutId, 
      paymentReference,
      notes
    } = await request.json();

    if (!payoutId) {
      return NextResponse.json({ error: 'Payout ID required' }, { status: 400 });
    }

    // Update payout status
    const { data: payout, error } = await supabase
      .from('commission_payouts')
      .update({
        payment_status: 'completed',
        payment_reference: paymentReference,
        paid_at: new Date().toISOString(),
        notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payout:', error);
      return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payout
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}