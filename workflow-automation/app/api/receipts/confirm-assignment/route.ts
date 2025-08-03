import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

interface ConfirmAssignmentRequest {
  processingLogId: string;
  opportunityId: string;
  opportunityName: string;
  userResponse: string;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  
  try {
    const {
      processingLogId,
      opportunityId,
      opportunityName,
      userResponse
    }: ConfirmAssignmentRequest = await request.json();
    
    console.log('Confirming receipt assignment:', {
      processingLogId,
      opportunityId,
      opportunityName,
      userResponse
    });
    
    // Get the processing log
    const { data: processingLog, error: logError } = await supabase
      .from('receipt_processing_log')
      .select('*')
      .eq('id', processingLogId)
      .single();
    
    if (logError || !processingLog) {
      return NextResponse.json({ 
        error: 'Processing log not found' 
      }, { status: 404 });
    }
    
    if (!processingLog.extracted_data) {
      return NextResponse.json({ 
        error: 'No extracted receipt data found' 
      }, { status: 400 });
    }
    
    // Get the team member who submitted the receipt
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id, name, organization_id')
      .eq('phone', processingLog.phone_number)
      .eq('organization_id', processingLog.organization_id)
      .single();
    
    if (!teamMember) {
      return NextResponse.json({ 
        error: 'Team member not found' 
      }, { status: 404 });
    }
    
    // Determine if this is a reimbursable expense based on payment method
    const lastFourDigits = processingLog.extracted_data.last_four_digits;
    let isReimbursable = true; // Default to reimbursable
    
    if (lastFourDigits) {
      // Check if it's a company card
      const { data: companyCard } = await supabase
        .from('company_credit_cards')
        .select('id')
        .eq('organization_id', processingLog.organization_id)
        .eq('last_four_digits', lastFourDigits)
        .eq('is_active', true)
        .single();
      
      if (companyCard) {
        isReimbursable = false;
      }
    }
    
    // Create the receipt record
    const receiptData = {
      organization_id: processingLog.organization_id,
      opportunity_id: opportunityId,
      contact_id: null, // Internal expense, no contact
      amount: processingLog.extracted_data.amount || 0,
      receipt_date: processingLog.extracted_data.receipt_date || new Date().toISOString().split('T')[0],
      receipt_type: 'expense',
      category: processingLog.extracted_data.category || 'Other',
      description: processingLog.extracted_data.description,
      image_url: processingLog.attachment_url,
      is_reimbursable: isReimbursable,
      reimbursement_status: isReimbursable ? 'pending' : null,
      team_member_id: teamMember.id,
      submitted_by_name: teamMember.name,
      submitted_by_phone: processingLog.phone_number,
      ai_extracted_data: processingLog.extracted_data,
      ai_confidence_score: (processingLog.extracted_data.confidence || 0) / 100,
      manual_review_required: false,
      is_company_card_expense: !isReimbursable
    };
    
    const { data: receipt, error: receiptError } = await supabase
      .from('opportunity_receipts')
      .insert(receiptData)
      .select()
      .single();
    
    if (receiptError) {
      console.error('Error creating receipt:', receiptError);
      return NextResponse.json({ 
        error: 'Failed to create receipt',
        details: receiptError.message 
      }, { status: 500 });
    }
    
    // Update the processing log
    await supabase
      .from('receipt_processing_log')
      .update({
        processing_status: 'completed',
        receipt_id: receipt.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', processingLogId);
    
    // Send confirmation message
    const confirmationMessage = `✅ Receipt logged successfully!\n\nJob: ${opportunityName}\nAmount: $${processingLog.extracted_data.amount}\nVendor: ${processingLog.extracted_data.vendor_name}\n${isReimbursable ? '\n⚠️ This is marked as REIMBURSABLE. Submit for reimbursement when ready.' : '\n✓ Company card expense - no reimbursement needed.'}`;
    
    // Send the confirmation via GHL
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processingLogId,
          responseMessage: confirmationMessage,
          phoneNumber: processingLog.phone_number
        })
      });
    } catch (sendError) {
      console.error('Error sending confirmation message:', sendError);
    }
    
    return NextResponse.json({
      success: true,
      receipt,
      isReimbursable,
      opportunityName
    });
    
  } catch (error: any) {
    console.error('Error confirming receipt assignment:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}