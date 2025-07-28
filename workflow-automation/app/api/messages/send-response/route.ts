import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGHLClient } from '@/lib/integrations/gohighlevel/client';
import { encrypt } from '@/lib/utils/encryption';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SendResponseRequest {
  processingLogId: string;
  responseMessage: string;
  phoneNumber?: string;
  contactId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      processingLogId,
      responseMessage,
      phoneNumber,
      contactId
    }: SendResponseRequest = await request.json();
    
    console.log('Sending response message:', {
      processingLogId,
      phoneNumber,
      contactId,
      messageLength: responseMessage.length
    });
    
    // Get the processing log to find the user and integration
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
    
    // Get the user's GHL integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', processingLog.user_id)
      .eq('type', 'gohighlevel')
      .single();
    
    if (integrationError || !integration) {
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found' 
      }, { status: 404 });
    }
    
    try {
      // Create GHL client with token refresh capability
      const ghlClient = await createGHLClient(
        integration.config.encryptedTokens,
        async (newTokens) => {
          const encryptedTokens = encrypt(JSON.stringify(newTokens));
          await supabase
            .from('integrations')
            .update({
              config: {
                ...integration.config,
                encryptedTokens,
                lastTokenRefresh: new Date().toISOString()
              }
            })
            .eq('id', integration.id);
        }
      );
      
      let sendResult;
      
      if (contactId) {
        // Send to specific contact ID
        console.log('Sending SMS to contact ID:', contactId);
        sendResult = await ghlClient.sendSMS(contactId, responseMessage);
      } else if (phoneNumber) {
        // Send to phone number
        console.log('Sending SMS to phone number:', phoneNumber);
        sendResult = await ghlClient.sendSMSToPhone(phoneNumber, responseMessage);
      } else {
        // Use the phone number from the processing log
        const logPhoneNumber = processingLog.phone_number;
        if (!logPhoneNumber) {
          return NextResponse.json({ 
            error: 'No phone number or contact ID provided' 
          }, { status: 400 });
        }
        
        console.log('Sending SMS to log phone number:', logPhoneNumber);
        sendResult = await ghlClient.sendSMSToPhone(logPhoneNumber, responseMessage);
      }
      
      console.log('Message sent successfully:', sendResult);
      
      // Update the processing log with the sent response
      await supabase
        .from('receipt_processing_log')
        .update({
          response_sent: true,
          response_sent_at: new Date().toISOString(),
          ghl_message_response: sendResult
        })
        .eq('id', processingLogId);
      
      return NextResponse.json({
        success: true,
        messageId: sendResult?.message?.id,
        conversationId: sendResult?.conversation?.id,
        sentAt: new Date().toISOString()
      });
      
    } catch (ghlError: any) {
      console.error('Error sending message via GHL:', ghlError);
      
      // Update processing log with send error
      await supabase
        .from('receipt_processing_log')
        .update({
          response_error: ghlError.message,
          processing_status: 'response_failed'
        })
        .eq('id', processingLogId);
      
      return NextResponse.json({ 
        error: 'Failed to send message via GoHighLevel',
        details: ghlError.message 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in send-response endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}