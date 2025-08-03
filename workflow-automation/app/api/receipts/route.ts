import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import { requireAuth } from '@/lib/auth/production-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    // Get user's organization through organization_members
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (orgError || !orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const opportunityId = searchParams.get('opportunityId');
    
    // If opportunityId is provided, fetch receipts for that specific opportunity
    if (opportunityId) {
      const { data: receipts, error } = await supabase
        .from('opportunity_receipts')
        .select('*')
        .eq('organization_id', orgMember.organization_id)
        .eq('opportunity_id', opportunityId)
        .order('receipt_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching receipts for opportunity:', error);
        return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
      }
      
      // Map fields for frontend compatibility
      const mappedReceipts = receipts?.map(receipt => {
        console.log('Processing receipt from DB:', {
          id: receipt.id,
          submitted_by_name: receipt.submitted_by_name,
          ai_extracted_data: receipt.ai_extracted_data,
          description: receipt.description
        });
        
        // Extract vendor_name from ai_extracted_data
        const vendorName = receipt.ai_extracted_data?.vendor_name || 'Unknown Vendor';
        const receiptNumber = receipt.ai_extracted_data?.receipt_number || null;
        const notes = receipt.ai_extracted_data?.notes || receipt.description || null;
        const paymentMethod = receipt.ai_extracted_data?.payment_method || 'other';
        const lastFourDigits = receipt.ai_extracted_data?.last_four_digits || null;
        
        console.log('Mapped receipt data:', {
          vendor_name: vendorName,
          submitted_by: receipt.submitted_by_name || 'Unknown',
          notes: notes
        });
        
        return {
          ...receipt,
          vendor_name: vendorName,
          receipt_number: receiptNumber,
          notes: notes,
          payment_method: paymentMethod,
          last_four_digits: lastFourDigits,
          submitted_by: receipt.submitted_by_name || 'Unknown',
          reimbursable: receipt.is_reimbursable, // Map is_reimbursable to reimbursable for frontend
          reimbursement_status: receipt.reimbursement_status
        };
      }) || [];
      
      return NextResponse.json({ receipts: mappedReceipts });
    }
    
    // If no opportunityId provided, fetch ALL receipts for the organization
    const { data: receipts, error } = await supabase
      .from('opportunity_receipts')
      .select('*')
      .eq('organization_id', orgMember.organization_id)
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
        .select('opportunity_id, title')
        .in('opportunity_id', opportunityIds);
      
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
          acc[opp.opportunity_id] = opp.title;
          return acc;
        }, {} as Record<string, string>);
      }
    }
    
    // Add opportunity name and map fields for frontend compatibility
    const receiptsWithOpportunityName = receipts?.map(receipt => {
      // Extract vendor_name from ai_extracted_data
      const vendorName = receipt.ai_extracted_data?.vendor_name || 'Unknown Vendor';
      const receiptNumber = receipt.ai_extracted_data?.receipt_number || null;
      // Use notes from ai_extracted_data or fall back to description field
      const notes = receipt.ai_extracted_data?.notes || receipt.description || null;
      const paymentMethod = receipt.ai_extracted_data?.payment_method || 'other';
      const lastFourDigits = receipt.ai_extracted_data?.last_four_digits || null;
      
      return {
        ...receipt,
        opportunity_name: receipt.opportunity_id ? (opportunityNames[receipt.opportunity_id] || null) : null,
        vendor_name: vendorName,
        receipt_number: receiptNumber,
        notes: notes,
        payment_method: paymentMethod,
        last_four_digits: lastFourDigits,
        submitted_by: receipt.submitted_by_name || 'Unknown',
        reimbursable: receipt.is_reimbursable, // Map is_reimbursable to reimbursable for frontend
        reimbursement_status: receipt.reimbursement_status
      };
    }) || [];
    
    return NextResponse.json({ receipts: receiptsWithOpportunityName });
    
  } catch (error) {
    console.error('Error in receipts GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();
    
    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (orgError || !orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 });
    }
    
    const {
      opportunityId,
      integrationId, // Received but not stored - opportunities are already linked to integrations
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
    
    if (!opportunityId || !finalVendorName || !amount || !category || !finalReceiptDate || !submitted_by) {
      return NextResponse.json({ 
        error: 'Missing required fields: opportunityId, vendor_name, amount, category, receipt_date, submitted_by' 
      }, { status: 400 });
    }
    
    // Determine reimbursable status based on card number and payment method
    let isReimbursable = false;
    
    if (last_four_digits) {
      // Check if this card is a company card
      const { data: companyCard } = await supabase
        .from('company_credit_cards')
        .select('id')
        .eq('last_four', last_four_digits)
        .eq('is_active', true)
        .single();
      
      if (companyCard) {
        // Card found in company cards - company cards are never reimbursable
        isReimbursable = false;
      } else {
        // Card not found in company cards = personal card = reimbursable
        isReimbursable = true;
      }
    } else {
      // No card number - check payment method
      if (payment_method === 'cash' || payment_method === 'check') {
        isReimbursable = true;
      } else {
        isReimbursable = false;
      }
    }
    
    // Create the AI extracted data JSON
    const aiExtractedData = {
      vendor_name: finalVendorName,
      receipt_number: finalReceiptNumber,
      notes: notes || description, // Store purchase description in notes
      tags: tags || [],
      payment_method: payment_method || 'other',
      last_four_digits: last_four_digits || null,
      manual_entry: true
    };

    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .insert({
        organization_id: orgMember.organization_id,
        opportunity_id: opportunityId,
        amount: parseFloat(amount),
        receipt_date: finalReceiptDate,
        receipt_type: 'expense', // Default to expense
        category: category,
        description: notes || description, // Store purchase description in description field
        is_reimbursable: isReimbursable,
        submitted_by_name: submitted_by,
        ai_extracted_data: aiExtractedData,
        ai_confidence_score: 1.0, // Manual entry has full confidence
        manual_review_required: false
      })
      .select()
      .single();
    
    // Check if the database trigger incorrectly set reimbursable and fix it
    if (receipt && last_four_digits) {
      // Check if this card is actually a company card
      const { data: companyCard } = await supabase
        .from('company_credit_cards')
        .select('id')
        .eq('last_four', last_four_digits)
        .eq('is_active', true)
        .single();
      
      const shouldBeReimbursable = companyCard ? false : true; // Company cards are never reimbursable
      
      // If the trigger set it wrong, fix it
      if (receipt.is_reimbursable !== shouldBeReimbursable) {
        console.log(`Fixing reimbursable status: trigger set ${receipt.is_reimbursable}, should be ${shouldBeReimbursable} for card ${last_four_digits}`);
        
        const { data: correctedReceipt } = await supabase
          .from('opportunity_receipts')
          .update({ is_reimbursable: shouldBeReimbursable })
          .eq('id', receipt.id)
          .select()
          .single();
          
        if (correctedReceipt) {
          receipt.is_reimbursable = correctedReceipt.is_reimbursable;
        }
      }
    }
    
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
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const body = await request.json();
    const { 
      id, 
      vendor_name,
      amount,
      category,
      receipt_date,
      notes,
      submitted_by,
      payment_method,
      last_four_digits,
      ...otherData 
    } = body;
    
    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (orgError || !orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 });
    }
    
    if (!id) {
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
    }
    
    // Get current receipt to merge with AI data
    const { data: currentReceipt } = await supabase
      .from('opportunity_receipts')
      .select('ai_extracted_data')
      .eq('id', id)
      .single();
    
    // Prepare the AI extracted data
    const aiExtractedData = {
      ...(currentReceipt?.ai_extracted_data || {}),
      vendor_name: vendor_name,
      notes: notes,
      payment_method: payment_method || 'other',
      last_four_digits: last_four_digits || null
    };
    
    // Determine reimbursable status based on card number
    let isReimbursable = false;
    if (last_four_digits) {
      const { data: companyCard } = await supabase
        .from('company_credit_cards')
        .select('id')
        .eq('last_four', last_four_digits)
        .eq('is_active', true)
        .single();
      
      isReimbursable = !companyCard; // Reimbursable if NOT a company card
    } else if (payment_method === 'cash' || payment_method === 'check') {
      isReimbursable = true;
    }
    
    // Build update object with only valid database fields
    const updateData = {
      amount: parseFloat(amount),
      category: category,
      receipt_date: receipt_date,
      description: notes, // Store notes in description field
      submitted_by_name: submitted_by,
      is_reimbursable: isReimbursable,
      ai_extracted_data: aiExtractedData,
      updated_at: new Date().toISOString()
    };
    
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', orgMember.organization_id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating receipt:', error);
      console.error('Update data was:', updateData);
      return NextResponse.json({ error: error.message || 'Failed to update receipt' }, { status: 500 });
    }
    
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    
    return NextResponse.json({ receipt });
    
  } catch (error) {
    console.error('Error in receipts PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (orgError || !orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 });
    }
    
    if (!id) {
      return NextResponse.json({ error: 'Receipt ID is required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('opportunity_receipts')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgMember.organization_id);
    
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