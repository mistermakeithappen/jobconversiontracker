import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UserResponse {
  phone?: string;
  email?: string;
  message: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received receipt response webhook:', body);

    // Parse the incoming message (format depends on your messaging platform)
    const userResponse = parseIncomingMessage(body);
    
    if (!userResponse) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    // Find the most recent pending receipt processing for this user
    const { data: pendingReceipt } = await supabase
      .from('receipt_processing_log')
      .select('*')
      .or(`user_phone.eq.${userResponse.phone},user_email.eq.${userResponse.email}`)
      .eq('status', 'pending_user_response')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!pendingReceipt) {
      // No pending receipt found - send helpful message
      await sendMessage(userResponse.phone || userResponse.email!, 
        "I don't have any pending receipts for you. Send me a receipt image to get started!");
      return NextResponse.json({ message: 'No pending receipt found' });
    }

    // Process the user's response
    const result = await processUserResponse(pendingReceipt, userResponse.message);
    
    // Send response back to user
    await sendMessage(userResponse.phone || userResponse.email!, result.message);

    // Update the receipt processing log
    await updateReceiptProcessingLog(pendingReceipt.id, userResponse.message, result);

    return NextResponse.json({ 
      success: true, 
      action: result.action,
      message: result.message 
    });

  } catch (error) {
    console.error('Error processing receipt response:', error);
    return NextResponse.json({ 
      error: 'Failed to process response',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function parseIncomingMessage(body: any): UserResponse | null {
  // This will vary based on your messaging platform (Twilio, WhatsApp Business API, etc.)
  // Example for Twilio SMS webhook:
  if (body.From && body.Body) {
    return {
      phone: body.From.replace(/^\+?1?/, ''), // Normalize phone number
      message: body.Body.trim(),
      timestamp: new Date().toISOString()
    };
  }

  // Example for email webhook:
  if (body.from && body.text) {
    return {
      email: body.from,
      message: body.text.trim(),
      timestamp: new Date().toISOString()
    };
  }

  // Example for WhatsApp Business API:
  if (body.messages && body.messages[0]) {
    const message = body.messages[0];
    return {
      phone: message.from,
      message: message.text?.body || '',
      timestamp: new Date().toISOString()
    };
  }

  return null;
}

async function processUserResponse(pendingReceipt: any, userMessage: string) {
  const receiptData = pendingReceipt.receipt_data;
  const jobMatches = pendingReceipt.job_matches || [];
  const responseType = pendingReceipt.response_sent.type;

  const normalizedMessage = userMessage.toLowerCase().trim();

  // Handle different response types
  switch (responseType) {
    case 'single_match':
      return await processSingleMatchResponse(pendingReceipt, normalizedMessage);
    
    case 'multiple_matches':
      return await processMultipleMatchResponse(pendingReceipt, normalizedMessage);
    
    case 'no_match':
      return await processNoMatchResponse(pendingReceipt, normalizedMessage);
    
    default:
      return {
        action: 'error',
        message: 'Sorry, I encountered an error processing your response. Please try again.'
      };
  }
}

async function processSingleMatchResponse(pendingReceipt: any, message: string) {
  if (message === 'yes' || message === 'y' || message === 'confirm') {
    // User confirmed the suggested job match
    const suggestedJobId = pendingReceipt.response_sent.suggestedJobId;
    const result = await createReceiptFromProcessing(pendingReceipt, suggestedJobId);
    
    if (result.success) {
      return {
        action: 'confirmed',
        message: `✅ Receipt logged successfully to "${result.opportunityName}"! Amount: ${formatCurrency(pendingReceipt.receipt_data.amount)}`,
        receiptId: result.receiptId
      };
    } else {
      return {
        action: 'error',
        message: 'Sorry, there was an error logging your receipt. Please try again or contact support.'
      };
    }
  } else if (message === 'no' || message === 'n') {
    // User rejected the suggestion - ask them to specify
    return {
      action: 'rejected',
      message: 'No problem! Please tell me which job this receipt belongs to, or send "CANCEL" to cancel this receipt.'
    };
  } else {
    // Try to match their response to a job name
    const matchedJob = await findJobByName(pendingReceipt.user_id, message);
    if (matchedJob) {
      const result = await createReceiptFromProcessing(pendingReceipt, matchedJob.opportunityId);
      if (result.success) {
        return {
          action: 'manual_match',
          message: `✅ Receipt logged to "${matchedJob.opportunityName}"! Amount: ${formatCurrency(pendingReceipt.receipt_data.amount)}`
        };
      }
    }
    
    return {
      action: 'clarify',
      message: 'I couldn\'t find a job with that name. Please reply "YES" to confirm the suggested job, "NO" to reject it, or specify the exact job name.'
    };
  }
}

async function processMultipleMatchResponse(pendingReceipt: any, message: string) {
  const options = pendingReceipt.response_sent.options || [];
  
  // Check if user selected a number
  const selection = parseInt(message);
  if (selection >= 1 && selection <= options.length) {
    const selectedJob = options[selection - 1];
    const result = await createReceiptFromProcessing(pendingReceipt, selectedJob.opportunityId);
    
    if (result.success) {
      return {
        action: 'selected',
        message: `✅ Receipt logged to "${selectedJob.opportunityName}"! Amount: ${formatCurrency(pendingReceipt.receipt_data.amount)}`
      };
    } else {
      return {
        action: 'error',
        message: 'Sorry, there was an error logging your receipt. Please try again.'
      };
    }
  } else {
    // Try to match their response to a job name
    const matchedJob = await findJobByName(pendingReceipt.user_id, message);
    if (matchedJob) {
      const result = await createReceiptFromProcessing(pendingReceipt, matchedJob.opportunityId);
      if (result.success) {
        return {
          action: 'manual_match',
          message: `✅ Receipt logged to "${matchedJob.opportunityName}"! Amount: ${formatCurrency(pendingReceipt.receipt_data.amount)}`
        };
      }
    }
    
    return {
      action: 'clarify',
      message: 'Please reply with a number (1, 2, 3) to select a job, or specify the exact job name.'
    };
  }
}

async function processNoMatchResponse(pendingReceipt: any, message: string) {
  if (message === 'cancel') {
    return {
      action: 'cancelled',
      message: 'Receipt processing cancelled. Send me another receipt image anytime!'
    };
  }

  // Try to find a job matching their description
  const matchedJob = await findJobByName(pendingReceipt.user_id, message);
  if (matchedJob) {
    const result = await createReceiptFromProcessing(pendingReceipt, matchedJob.opportunityId);
    if (result.success) {
      return {
        action: 'manual_match',
        message: `✅ Receipt logged to "${matchedJob.opportunityName}"! Amount: ${formatCurrency(pendingReceipt.receipt_data.amount)}`
      };
    }
  }

  return {
    action: 'clarify',
    message: 'I couldn\'t find a job with that name. Please provide the exact job name or send "CANCEL" to cancel this receipt.'
  };
}

async function findJobByName(userId: string, jobName: string) {
  const { data: opportunities } = await supabase
    .from('opportunity_cache')
    .select('opportunity_id, name, contact_name')
    .eq('user_id', userId)
    .eq('status', 'open');

  if (!opportunities) return null;

  // Try exact match first
  const exactMatch = opportunities.find(opp => 
    opp.name.toLowerCase() === jobName.toLowerCase()
  );
  if (exactMatch) {
    return {
      opportunityId: exactMatch.opportunity_id,
      opportunityName: exactMatch.name
    };
  }

  // Try partial match
  const partialMatch = opportunities.find(opp => 
    opp.name.toLowerCase().includes(jobName.toLowerCase()) ||
    jobName.toLowerCase().includes(opp.name.toLowerCase())
  );
  if (partialMatch) {
    return {
      opportunityId: partialMatch.opportunity_id,
      opportunityName: partialMatch.name
    };
  }

  return null;
}

async function createReceiptFromProcessing(pendingReceipt: any, opportunityId: string) {
  try {
    const receiptData = pendingReceipt.receipt_data;
    
    // Create the receipt record
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .insert({
        user_id: pendingReceipt.user_id,
        opportunity_id: opportunityId,
        integration_id: null, // This will be set if we have integration context
        vendor_name: receiptData.vendor_name,
        description: receiptData.description,
        amount: receiptData.amount,
        category: receiptData.category,
        receipt_date: receiptData.receipt_date,
        receipt_number: receiptData.receipt_number,
        notes: `Auto-processed from receipt image (${receiptData.confidence}% confidence)`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating receipt:', error);
      return { success: false };
    }

    // Get opportunity name for response
    const { data: opportunity } = await supabase
      .from('opportunity_cache')
      .select('name')
      .eq('opportunity_id', opportunityId)
      .single();

    return {
      success: true,
      receiptId: receipt.id,
      opportunityName: opportunity?.name || 'Unknown Job'
    };

  } catch (error) {
    console.error('Error creating receipt from processing:', error);
    return { success: false };
  }
}

async function updateReceiptProcessingLog(logId: string, userResponse: string, result: any) {
  const updateData: any = {
    user_response: userResponse,
    user_responded_at: new Date().toISOString()
  };

  switch (result.action) {
    case 'confirmed':
    case 'selected':
    case 'manual_match':
      updateData.status = 'confirmed';
      updateData.completed_at = new Date().toISOString();
      if (result.receiptId) {
        updateData.final_receipt_id = result.receiptId;
      }
      break;
    
    case 'cancelled':
      updateData.status = 'cancelled';
      updateData.completed_at = new Date().toISOString();
      break;
    
    case 'error':
      updateData.status = 'error';
      updateData.completed_at = new Date().toISOString();
      break;
  }

  await supabase
    .from('receipt_processing_log')
    .update(updateData)
    .eq('id', logId);
}

async function sendMessage(recipient: string, message: string) {
  // This would integrate with your messaging platform
  // For now, we'll just log it
  console.log(`Sending message to ${recipient}: ${message}`);
  
  // Example integrations:
  // - Twilio SMS: await twilioClient.messages.create({...})
  // - WhatsApp Business API: await whatsappClient.sendMessage({...})
  // - Email: await sendgridClient.send({...})
  // - GoHighLevel messaging: await ghlClient.sendMessage({...})
  
  return true;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}