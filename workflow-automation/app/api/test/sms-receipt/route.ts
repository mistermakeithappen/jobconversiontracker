import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/production-auth-server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

// Test endpoint to simulate SMS receipt processing
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);
    const supabase = getServiceSupabase();
    
    const { imageUrl, phoneNumber } = await request.json();
    
    if (!imageUrl || !phoneNumber) {
      return NextResponse.json({ 
        error: 'Missing required fields: imageUrl and phoneNumber' 
      }, { status: 400 });
    }
    
    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    
    if (!orgMember?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }
    
    // Get the integration for this organization
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgMember.organization_id)
      .eq('type', 'gohighlevel')
      .single();
    
    if (!integration) {
      return NextResponse.json({ 
        error: 'GoHighLevel integration not found' 
      }, { status: 404 });
    }
    
    // Create a test message in the database
    const { data: testMessage } = await supabase
      .from('incoming_messages')
      .insert({
        user_id: userId,
        integration_id: integration.id,
        contact_id: null,
        ghl_message_id: `test-${Date.now()}`,
        ghl_conversation_id: `test-conv-${Date.now()}`,
        ghl_contact_id: `test-contact-${Date.now()}`,
        phone_number: phoneNumber,
        message_type: 'sms',
        body: 'Test receipt image',
        attachments: [{
          id: `test-attachment-${Date.now()}`,
          url: imageUrl,
          fileName: 'test-receipt.jpg',
          mimeType: 'image/jpeg'
        }],
        direction: 'inbound',
        has_receipt: true,
        ghl_created_at: new Date().toISOString(),
        received_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (!testMessage) {
      return NextResponse.json({ 
        error: 'Failed to create test message' 
      }, { status: 500 });
    }
    
    // Trigger receipt processing
    const processResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/receipts/process-from-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId: testMessage.id,
        attachmentId: testMessage.attachments[0].id,
        attachmentUrl: imageUrl,
        contactPhone: phoneNumber,
        userId: userId,
        integrationId: integration.id,
        organizationId: orgMember.organization_id
      })
    });
    
    const processResult = await processResponse.json();
    
    return NextResponse.json({
      success: true,
      messageId: testMessage.id,
      processingResult: processResult,
      note: 'Check the phone number for the SMS response with job matching options'
    });
    
  } catch (error: any) {
    console.error('Test SMS receipt error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error.message 
    }, { status: 500 });
  }
}