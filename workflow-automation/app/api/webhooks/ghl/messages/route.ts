import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GHLMessageWebhook {
  type: string;
  locationId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  message: {
    id: string;
    conversationId: string;
    contactId: string;
    locationId: string;
    direction: 'inbound' | 'outbound';
    messageType: 'SMS' | 'MMS' | 'EMAIL' | 'WHATSAPP' | 'GMB' | 'CALL';
    body: string;
    attachments?: Array<{
      id: string;
      url: string;
      fileName: string;
      mimeType: string;
      size?: number;
    }>;
    meta?: {
      phoneNumber?: string;
      email?: string;
      fingerprint?: string;
    };
    dateAdded: string;
    dateUpdated: string;
  };
  contact: {
    id: string;
    locationId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
  };
}

// Helper function to determine if an attachment is likely a receipt
function isReceiptAttachment(attachment: any): boolean {
  const fileName = (attachment.fileName || '').toLowerCase();
  const mimeType = (attachment.mimeType || '').toLowerCase();
  
  // Check for image files (most receipts are photos)
  if (mimeType.startsWith('image/')) {
    return true;
  }
  
  // Check for receipt-related file names
  const receiptKeywords = ['receipt', 'invoice', 'bill', 'purchase', 'payment'];
  if (receiptKeywords.some(keyword => fileName.includes(keyword))) {
    return true;
  }
  
  // Check for PDF files that might be receipts
  if (mimeType === 'application/pdf') {
    return true;
  }
  
  return false;
}

// Helper function to determine if message body suggests a receipt
function isReceiptMessage(body: string): boolean {
  const lowerBody = body.toLowerCase();
  const receiptKeywords = [
    'receipt', 'invoice', 'bill', 'expense', 'purchase',
    'paid', 'cost', 'spent', 'bought', 'materials',
    'supplies', 'gas', 'fuel', 'tool', 'equipment',
    'hardware', 'depot', 'lowes', 'store'
  ];
  
  return receiptKeywords.some(keyword => lowerBody.includes(keyword));
}

export async function POST(request: NextRequest) {
  console.log('=== GHL WEBHOOK RECEIVED ===');
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const webhookData: GHLMessageWebhook = await request.json();
    console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));
    
    console.log('Received GHL message webhook:', {
      type: webhookData.type,
      messageType: webhookData.message?.messageType,
      direction: webhookData.message?.direction,
      hasAttachments: !!webhookData.message?.attachments?.length,
      contactPhone: webhookData.contact?.phone,
      contactName: webhookData.contact?.fullName || `${webhookData.contact?.firstName || ''} ${webhookData.contact?.lastName || ''}`.trim()
    });
    
    // Only process inbound messages
    if (webhookData.message?.direction !== 'inbound') {
      return NextResponse.json({ status: 'ignored', reason: 'outbound_message' });
    }
    
    // Extract phone number for lookup
    const phoneNumber = webhookData.contact?.phone || webhookData.message?.meta?.phoneNumber;
    
    // Check if this phone number belongs to an internal team member (GHL user)
    if (phoneNumber) {
      const { data: ghlUser } = await supabase
        .from('user_payment_structures')
        .select('ghl_user_id')
        .or(`ghl_user_phone.eq.${phoneNumber},phone.eq.${phoneNumber}`)
        .single();
      
      if (!ghlUser) {
        console.log('Message from non-team member phone:', phoneNumber);
        return NextResponse.json({ 
          status: 'ignored', 
          reason: 'not_internal_team_member',
          message: 'Only messages from internal team members are processed for receipts and time tracking'
        });
      }
      
      console.log('Message from internal team member with GHL user ID:', ghlUser.ghl_user_id);
    } else {
      console.log('No phone number found in message');
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'no_phone_number' 
      });
    }
    
    // Find the integration that matches this locationId
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .contains('config', { locationId: webhookData.locationId })
      .single();
    
    if (integrationError || !integration) {
      console.error('No integration found for locationId:', webhookData.locationId);
      return NextResponse.json({ 
        status: 'error', 
        reason: 'integration_not_found',
        locationId: webhookData.locationId 
      }, { status: 404 });
    }
    
    // No need to look up contacts - we're only handling internal team members
    // The phone number validation above ensures this is a team member
    
    // Check if this message has receipt-related content
    const hasReceiptAttachments = webhookData.message?.attachments?.some(isReceiptAttachment) || false;
    const isReceiptText = isReceiptMessage(webhookData.message?.body || '');
    const hasReceipt = hasReceiptAttachments || isReceiptText;
    
    // Store the incoming message from team member
    const messageData = {
      user_id: integration.user_id,
      integration_id: integration.id,
      contact_id: null, // Not tracking contacts, only team members
      ghl_message_id: webhookData.messageId,
      ghl_conversation_id: webhookData.conversationId,
      ghl_contact_id: webhookData.contactId, // Still store for reference
      phone_number: phoneNumber,
      message_type: webhookData.message.messageType.toLowerCase(),
      body: webhookData.message.body,
      attachments: webhookData.message.attachments || [],
      direction: webhookData.message.direction,
      has_receipt: hasReceipt,
      ghl_created_at: webhookData.message.dateAdded,
      received_at: new Date().toISOString()
    };
    
    const { data: storedMessage, error: messageError } = await supabase
      .from('incoming_messages')
      .insert(messageData)
      .select()
      .single();
    
    if (messageError) {
      console.error('Error storing incoming message:', messageError);
      return NextResponse.json({ 
        status: 'error', 
        reason: 'storage_failed',
        error: messageError.message 
      }, { status: 500 });
    }
    
    console.log('Message stored successfully:', {
      messageId: storedMessage.id,
      hasReceipt,
      isTeamMember: true,
      attachmentCount: webhookData.message?.attachments?.length || 0
    });
    
    // If this looks like a receipt, trigger receipt processing
    if (hasReceipt && webhookData.message?.attachments?.length > 0) {
      try {
        // Process each attachment that looks like a receipt
        for (const attachment of webhookData.message.attachments) {
          if (isReceiptAttachment(attachment)) {
            console.log('Processing receipt attachment:', attachment.fileName);
            
            // Trigger receipt processing asynchronously
            fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/receipts/process-from-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messageId: storedMessage.id,
                attachmentId: attachment.id,
                attachmentUrl: attachment.url,
                contactPhone: phoneNumber,
                userId: integration.user_id,
                integrationId: integration.id
              })
            }).catch(error => {
              console.error('Error triggering receipt processing:', error);
            });
          }
        }
      } catch (processingError) {
        console.error('Error initiating receipt processing:', processingError);
      }
    }
    
    return NextResponse.json({ 
      status: 'success',
      messageId: storedMessage.id,
      hasReceipt,
      willProcessReceipts: hasReceipt && webhookData.message?.attachments?.length > 0,
      isTeamMember: true
    });
    
  } catch (error: any) {
    console.error('Error processing GHL message webhook:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint for webhook verification (if GHL requires it)
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