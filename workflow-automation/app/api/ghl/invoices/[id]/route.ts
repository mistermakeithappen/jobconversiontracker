import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { GHLClient } from '@/lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check subscription before proceeding
    const { userId } = await requireSubscription(request);
    const organization = await getUserOrganization(userId);
    
    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      );
    }
    
    const supabase = getServiceSupabase();
    
    // Query the specific invoice from the dedicated table
    const { data: invoice, error } = await supabase
      .from('ghl_invoices')
      .select(`
        *,
        source_estimate:estimate_id (
          ghl_estimate_id,
          estimate_number,
          status,
          amount
        ),
        status_history:ghl_invoice_status_history (
          from_status,
          to_status,
          changed_at,
          changed_by,
          payment_amount,
          payment_method,
          transaction_id,
          notes
        )
      `)
      .eq('organization_id', organization.organizationId)
      .eq('ghl_invoice_id', params.id)
      .single();

    if (error) {
      console.error('Error fetching invoice:', error);
      
      // Fallback to GHL API if database table doesn't exist yet
      console.log('Falling back to GHL API...');
      return await getFallbackInvoiceDetail(supabase, organization.organizationId, params.id);
    }

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format
    const transformedInvoice = {
      id: invoice.ghl_invoice_id,
      invoiceNumber: invoice.invoice_number,
      name: invoice.name,
      amount: invoice.amount,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status,
      contactId: invoice.contact_id,
      opportunityId: invoice.opportunity_id,
      contact: null, // TODO: Join with contacts table if needed
      createdAt: invoice.created_date || invoice.created_at,
      sentAt: invoice.sent_date,
      dueDate: invoice.due_date,
      paidDate: invoice.paid_date,
      sourceEstimate: invoice.source_estimate,
      description: invoice.description,
      lineItems: invoice.line_items,
      paymentTerms: invoice.payment_terms,
      notes: invoice.notes,
      metadata: invoice.metadata,
      
      // Status history for timeline
      statusHistory: invoice.status_history?.map((history: any) => ({
        fromStatus: history.from_status,
        toStatus: history.to_status,
        changedAt: history.changed_at,
        changedBy: history.changed_by,
        paymentAmount: history.payment_amount,
        paymentMethod: history.payment_method,
        transactionId: history.transaction_id,
        notes: history.notes
      })) || []
    };

    return NextResponse.json({
      invoice: transformedInvoice
    });

  } catch (error) {
    console.error('Invoice detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

// Fallback function to get invoice from GHL API (for when database table doesn't exist yet)
async function getFallbackInvoiceDetail(supabase: any, organizationId: string, invoiceId: string) {
  try {
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();
      
    if (!integration || !integration.tokens) {
      return NextResponse.json(
        { error: 'GoHighLevel integration not found or not configured' },
        { status: 404 }
      );
    }

    // Decrypt tokens and create GHL client
    const encryptedTokens = integration.tokens;
    const tokens = {
      accessToken: decrypt(encryptedTokens.accessToken),
      refreshToken: decrypt(encryptedTokens.refreshToken),
      expiresAt: encryptedTokens.expiresAt,
      locationId: encryptedTokens.locationId || integration.config?.locationId,
      companyId: encryptedTokens.companyId || '',
      userId: encryptedTokens.userId || ''
    };

    const ghlClient = new GHLClient(tokens, async (newTokens) => {
      // Update tokens in database
      const { error } = await supabase
        .from('integrations')
        .update({
          tokens: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: encrypt(newTokens.refreshToken),
            expiresAt: newTokens.expiresAt,
            locationId: newTokens.locationId,
            companyId: newTokens.companyId,
            userId: newTokens.userId
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);
        
      if (error) {
        console.error('Failed to update tokens:', error);
      }
    });

    // Fetch single invoice from GoHighLevel
    const invoice = await ghlClient.getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      invoice
    });

  } catch (error) {
    console.error('Invoice fallback API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}