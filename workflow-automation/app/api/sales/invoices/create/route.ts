import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.name || !data.contact_id || !data.integration_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, contact_id, integration_id' },
        { status: 400 }
      );
    }

    // Validate line items
    if (!data.line_items || !Array.isArray(data.line_items) || data.line_items.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Generate a unique GHL invoice ID (this would normally come from GHL API)
    const ghlInvoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Calculate totals from line items
    const subtotal = data.line_items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.total) || 0);
    }, 0);
    
    const taxRate = data.applied_tax_rate || 0;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Prepare invoice data
    const invoiceData = {
      id: uuidv4(),
      organization_id: organization.organizationId,
      integration_id: data.integration_id,
      ghl_invoice_id: ghlInvoiceId,
      invoice_number: data.invoice_number || `INV-${Date.now()}`,
      
      // Relationships
      opportunity_id: data.opportunity_id || null,
      estimate_id: data.estimate_id || null, // If converting from estimate
      contact_id: data.contact_id,
      
      // Invoice details
      name: data.name,
      description: data.description || null,
      amount: totalAmount,
      currency: 'USD',
      status: data.status || 'draft',
      
      // Payment tracking
      amount_paid: 0,
      
      // Dates
      created_date: new Date().toISOString(),
      due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
      sent_date: data.sent_date || null,
      
      // Line items and metadata
      line_items: data.line_items,
      payment_terms: data.payment_terms || 'Net 30',
      notes: data.notes || null,
      
      // Property and tax info
      property_id: data.property_id || null,
      property_address: data.property_address || null,
      applied_tax_rate: taxRate,
      
      // Metadata including projections
      metadata: {
        ...data.metadata,
        subtotal: subtotal,
        tax_amount: taxAmount,
        tax_rate: (taxRate * 100), // Store as percentage for display
        created_via: 'web_app',
        created_by: userId
      },
      
      // Timestamps
      synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert the invoice
    const { data: invoice, error: insertError } = await supabase
      .from('ghl_invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invoice:', insertError);
      return NextResponse.json(
        { error: 'Failed to create invoice', details: insertError.message },
        { status: 500 }
      );
    }

    // If this invoice was converted from an estimate, update the estimate
    if (data.estimate_id) {
      const { error: updateError } = await supabase
        .from('ghl_estimates')
        .update({
          converted_to_invoice: true,
          converted_invoice_id: invoice.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.estimate_id)
        .eq('organization_id', organization.organizationId);

      if (updateError) {
        console.error('Error updating estimate conversion status:', updateError);
        // Don't fail the invoice creation, but log the error
      }
    }

    // TODO: Here you would typically also sync with GHL API
    // For now, we'll just store locally and sync later

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        ghl_invoice_id: invoice.ghl_invoice_id,
        invoice_number: invoice.invoice_number,
        name: invoice.name,
        amount: invoice.amount,
        status: invoice.status,
        due_date: invoice.due_date,
        created_at: invoice.created_at
      }
    });

  } catch (error) {
    console.error('Error in invoice creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}