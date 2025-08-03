import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  
  try {
    const webhookData = await request.json();
    console.log('Receipt confirmation webhook received:', webhookData);
    
    // Only process inbound messages
    if (webhookData.message?.direction !== 'inbound') {
      return NextResponse.json({ status: 'ignored', reason: 'outbound_message' });
    }
    
    const phoneNumber = webhookData.contact?.phone || webhookData.message?.meta?.phoneNumber;
    const messageBody = webhookData.message?.body || '';
    
    if (!phoneNumber) {
      return NextResponse.json({ status: 'ignored', reason: 'no_phone_number' });
    }
    
    // Check if this is from a team member
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id, organization_id')
      .eq('phone', phoneNumber)
      .single();
    
    if (!teamMember) {
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'not_team_member' 
      });
    }
    
    // Find the most recent pending receipt processing for this phone number
    const { data: processingLog } = await supabase
      .from('receipt_processing_log')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('organization_id', teamMember.organization_id)
      .eq('processing_status', 'response_sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!processingLog || !processingLog.potential_matches) {
      console.log('No pending receipt confirmation found for phone:', phoneNumber);
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'no_pending_confirmation' 
      });
    }
    
    const userResponse = messageBody.trim().toLowerCase();
    const matches = processingLog.potential_matches as any[];
    
    let selectedMatch = null;
    
    // Check if user responded with a number (1, 2, 3, etc)
    const numberMatch = userResponse.match(/^(\d+)$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1;
      if (index >= 0 && index < matches.length) {
        selectedMatch = matches[index];
      }
    }
    
    // Check if user responded with YES (for single match confirmation)
    if (!selectedMatch && (userResponse === 'yes' || userResponse === 'y')) {
      if (matches.length === 1) {
        selectedMatch = matches[0];
      }
    }
    
    // Check if user typed a job name
    if (!selectedMatch) {
      // Search for a match by name
      selectedMatch = matches.find(match => 
        match.opportunity_name.toLowerCase().includes(userResponse) ||
        userResponse.includes(match.opportunity_name.toLowerCase())
      );
    }
    
    if (selectedMatch) {
      // User confirmed a match - create the receipt
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/receipts/confirm-assignment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processingLogId: processingLog.id,
            opportunityId: selectedMatch.opportunity_id,
            opportunityName: selectedMatch.opportunity_name,
            userResponse: messageBody
          })
        });
        
        if (response.ok) {
          return NextResponse.json({ 
            status: 'success',
            action: 'receipt_assigned',
            opportunityId: selectedMatch.opportunity_id
          });
        }
      } catch (error) {
        console.error('Error confirming receipt assignment:', error);
      }
    } else {
      // User response didn't match any options - ask for clarification
      const clarificationMessage = `I couldn't find a job matching "${messageBody}". Please reply with:\n- The number (1, 2, 3) from the list\n- YES to confirm the suggested job\n- The exact job name`;
      
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processingLogId: processingLog.id,
            responseMessage: clarificationMessage,
            phoneNumber: phoneNumber
          })
        });
      } catch (error) {
        console.error('Error sending clarification message:', error);
      }
    }
    
    return NextResponse.json({ 
      status: 'processed',
      hadMatch: !!selectedMatch
    });
    
  } catch (error: any) {
    console.error('Error processing receipt confirmation webhook:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({ status: 'webhook_endpoint_active' });
}