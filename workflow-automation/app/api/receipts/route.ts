import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockAuthServer } from '@/lib/auth/mock-auth-server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const searchParams = request.nextUrl.searchParams;
    const opportunityId = searchParams.get('opportunityId');
    
    // If opportunityId is provided, fetch receipts for that specific opportunity
    if (opportunityId) {
      const { data: receipts, error } = await supabase
        .from('opportunity_receipts')
        .select('*')
        .eq('user_id', userId)
        .eq('opportunity_id', opportunityId)
        .order('receipt_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching receipts for opportunity:', error);
        return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
      }
      
      return NextResponse.json({ receipts });
    }
    
    // If no opportunityId provided, fetch ALL receipts for the user
    const { data: receipts, error } = await supabase
      .from('opportunity_receipts')
      .select('*')
      .eq('user_id', userId)
      .order('receipt_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching all receipts:', error);
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
    }
    
    // Fetch opportunity names for all receipts
    const opportunityIds = [...new Set(receipts?.map(r => r.opportunity_id).filter(Boolean) || [])];
    let opportunityNames: Record<string, string> = {};
    
    if (opportunityIds.length > 0) {
      // Try to get opportunities from cache first
      const { data: opportunities } = await supabase
        .from('opportunity_cache')
        .select('id, name')
        .in('id', opportunityIds);
      
      // If no opportunities found in cache, fetch from opportunities API and use that data
      if (!opportunities || opportunities.length === 0) {
        try {
          const oppResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/automake/opportunities`);
          const oppData = await oppResponse.json();
          
          if (oppResponse.ok && oppData.opportunities) {
            // Create mapping from the API response
            opportunityNames = oppData.opportunities.reduce((acc: Record<string, string>, opp: any) => {
              if (opportunityIds.includes(opp.id)) {
                acc[opp.id] = opp.name;
              }
              return acc;
            }, {});
          }
        } catch (apiError) {
          console.error('Error fetching opportunities for receipt names:', apiError);
        }
      } else {
        opportunityNames = opportunities.reduce((acc, opp) => {
          acc[opp.id] = opp.name;
          return acc;
        }, {} as Record<string, string>);
      }
    }
    
    // Add opportunity name and reimbursable status to each receipt
    const receiptsWithOpportunityName = receipts?.map(receipt => ({
      ...receipt,
      opportunity_name: opportunityNames[receipt.opportunity_id] || 'Unknown Opportunity',
      is_reimbursable: receipt.reimbursable
    })) || [];
    
    return NextResponse.json({ receipts: receiptsWithOpportunityName });
    
  } catch (error) {
    console.error('Error in receipts GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    
    const {
      opportunityId,
      integrationId,
      vendor_name,
      vendorName, // Legacy support
      description,
      amount,
      category,
      receipt_date,
      receiptDate, // Legacy support
      receipt_number,
      receiptNumber, // Legacy support
      notes,
      tags,
      submitted_by,
      payment_method,
      last_four_digits,
      reimbursable
    } = body;
    
    // Use new field names or fall back to legacy names
    const finalVendorName = vendor_name || vendorName;
    const finalReceiptDate = receipt_date || receiptDate;
    const finalReceiptNumber = receipt_number || receiptNumber;
    
    if (!opportunityId || !integrationId || !finalVendorName || !amount || !category || !finalReceiptDate || !submitted_by) {
      return NextResponse.json({ 
        error: 'Missing required fields: opportunityId, integrationId, vendor_name, amount, category, receipt_date, submitted_by' 
      }, { status: 400 });
    }
    
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .insert({
        user_id: userId,
        opportunity_id: opportunityId,
        integration_id: integrationId,
        vendor_name: finalVendorName,
        description,
        amount: parseFloat(amount),
        category,
        receipt_date: finalReceiptDate,
        receipt_number: finalReceiptNumber,
        notes,
        tags: tags || [],
        submitted_by,
        payment_method: payment_method || 'other',
        last_four_digits: payment_method === 'credit_card' ? last_four_digits : null,
        reimbursable: reimbursable !== undefined ? reimbursable : true,
        submitter_user_id: userId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating receipt:', error);
      return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 });
    }
    
    return NextResponse.json({ receipt });
    
  } catch (error) {
    console.error('Error in receipts POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
    }
    
    // Remove fields that shouldn't be updated
    delete updateData.user_id;
    delete updateData.opportunity_id;
    delete updateData.integration_id;
    delete updateData.created_at;
    
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }
    
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating receipt:', error);
      return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 });
    }
    
    return NextResponse.json({ receipt });
    
  } catch (error) {
    console.error('Error in receipts PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = mockAuthServer();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('opportunity_receipts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting receipt:', error);
      return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in receipts DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}