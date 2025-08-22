import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getUserOrganization } from '@/lib/auth/organization-helper';
import { GHLClient } from '@/lib/integrations/gohighlevel/client';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { requireSubscription } from '@/lib/utils/subscription-utils';

export async function GET(request: NextRequest) {
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
    
    // Get organization's GHL integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organization.organizationId)
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const limit = parseInt(searchParams.get('limit') || '25');
    const startAfterId = searchParams.get('startAfterId');

    // Query invoices from the dedicated ghl_invoices table
    let queryBuilder = supabase
      .from('ghl_invoices')
      .select(`
        *,
        source_estimate:estimate_id (
          ghl_estimate_id,
          estimate_number,
          status,
          amount
        )
      `)
      .eq('organization_id', organization.organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }
    
    if (contactId) {
      queryBuilder = queryBuilder.eq('contact_id', contactId);
    }
    
    if (startAfterId) {
      queryBuilder = queryBuilder.gt('created_at', startAfterId);
    }
    
    queryBuilder = queryBuilder.limit(limit);

    const { data: invoices, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching invoices:', error);
      
      // Fallback to GHL API if database table doesn't exist yet
      console.log('Falling back to GHL API...');
      try {
        const ghlInvoices = await ghlClient.getInvoices({
          status,
          contactId,
          limit,
          startAfterId
        });

        return NextResponse.json({
          invoices: ghlInvoices.invoices || [],
          totalCount: ghlInvoices.totalCount || 0,
          nextCursor: ghlInvoices.nextCursor
        });
      } catch (ghlError) {
        console.error('GHL API fallback failed:', ghlError);
        return NextResponse.json({
          invoices: [],
          totalCount: 0
        });
      }
    }

    // Transform the data to match the expected format
    const transformedInvoices = (invoices || []).map(invoice => ({
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
      metadata: invoice.metadata
    }));

    return NextResponse.json({
      invoices: transformedInvoices,
      totalCount: transformedInvoices.length
    });

  } catch (error) {
    console.error('Invoice API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}