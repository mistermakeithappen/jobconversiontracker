import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { WebFileConverter } from '@/lib/utils/web-file-converter';
import { decrypt } from '@/lib/utils/encryption';
import ApiKeyManager from '@/lib/utils/api-key-manager';
import { findMatchingJobs, findCompletedJobMatches, type ReceiptData } from '@/lib/services/receipt-matching';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';

// Use service role client for server-side operations
const getSupabase = () => getServiceSupabase();

interface ProcessFromMessageRequest {
  messageId: string;
  attachmentId: string;
  attachmentUrl: string;
  contactPhone: string;
  userId: string;
  integrationId: string;
  organizationId: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messageId,
      attachmentId,
      attachmentUrl,
      contactPhone,
      userId,
      integrationId,
      organizationId
    }: ProcessFromMessageRequest = await request.json();
    
    console.log('Processing receipt from message:', {
      messageId,
      attachmentId,
      contactPhone,
      userId
    });
    
    const supabase = getSupabase();
    
    // Get the organization's OpenAI API key
    const { data: apiKey } = await supabase
      .from('user_api_keys')
      .select('api_key')
      .eq('organization_id', organizationId)
      .eq('service', 'openai')
      .eq('is_active', true)
      .single();
    
    if (!apiKey?.api_key) {
      console.error('No OpenAI API key found for organization:', organizationId);
      // Send a message explaining they need to add an API key
      await sendApiKeyRequiredMessage(contactPhone, integrationId, userId, organizationId);
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        sentNotification: true
      }, { status: 400 });
    }
    
    const userApiKey = apiKey.api_key;
    
    // Create processing log entry
    const { data: processingLog, error: logError } = await supabase
      .from('receipt_processing_log')
      .insert({
        organization_id: organizationId,
        source: 'sms',
        phone_number: contactPhone,
        attachment_url: attachmentUrl,
        processing_status: 'processing',
        message_id: messageId,
        attachment_id: attachmentId
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Error creating processing log:', logError);
    }
    
    try {
      // Step 1: Download the attachment file
      console.log('Downloading attachment from:', attachmentUrl);
      const fileResponse = await fetch(attachmentUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download attachment: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
      console.log(`Downloaded file: ${contentType} (${fileBuffer.length} bytes)`);
      
      // Step 2: Convert file to optimized PNG
      const conversionResult = await FileConverter.convertToPNG(fileBuffer, contentType);
      if (!conversionResult.success || !conversionResult.pngBuffer) {
        throw new Error(`File conversion failed: ${conversionResult.error}`);
      }
      
      // Step 3: Create data URL for OpenAI
      const imageDataUrl = FileConverter.createPNGDataURL(conversionResult.pngBuffer);
      console.log(`Converted ${conversionResult.originalFormat} to PNG (${conversionResult.pngBuffer.length} bytes)`);
      
      // Step 4: Process the converted image with OpenAI Vision
      console.log('Processing converted receipt image with OpenAI Vision...');
      
      const openai = new OpenAI({ apiKey: userApiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt image and extract the following information. Return ONLY a JSON object with no additional text or formatting:
                {
                  "vendor_name": "Business name from the receipt",
                  "amount": "Total amount as a number (no currency symbols)",
                  "receipt_date": "Date in YYYY-MM-DD format",
                  "description": "Brief description of items/services",
                  "receipt_number": "Receipt/invoice number if visible",
                  "category": "Best category: Materials, Labor, Equipment, Subcontractor, Travel, Permits, Insurance, or Other",
                  "payment_method": "credit_card, cash, check, debit_card, or other",
                  "last_four_digits": "Last 4 digits of card if visible (null if not)",
                  "confidence": "Confidence score 0-100 for data accuracy"
                }
                
                Rules:
                - Return ONLY the JSON object, no markdown formatting, no explanations
                - Use null for fields you cannot read clearly
                - For amount, use only numbers (e.g., 123.45 not "$123.45")
                - confidence should be a number between 0 and 100`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });
      
      const aiResponse = response.choices[0]?.message?.content;
      console.log('OpenAI Vision response:', aiResponse);
      
      if (!aiResponse) {
        throw new Error('No response from OpenAI Vision API');
      }
      
      // Parse the JSON response
      let receiptData;
      try {
        // Try to extract JSON from the response (in case it's wrapped in markdown or other text)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        receiptData = JSON.parse(jsonString);
        
        // Validate and clean the data
        receiptData = {
          vendor_name: receiptData.vendor_name || 'Unknown Vendor',
          amount: parseFloat(receiptData.amount) || 0,
          receipt_date: receiptData.receipt_date || new Date().toISOString().split('T')[0],
          description: receiptData.description || null,
          receipt_number: receiptData.receipt_number || null,
          category: receiptData.category || 'Other',
          payment_method: receiptData.payment_method || 'other',
          last_four_digits: receiptData.last_four_digits || null,
          confidence: Math.min(100, Math.max(0, parseInt(receiptData.confidence) || 0))
        };
      } catch (parseError) {
        console.error('Error parsing OpenAI response as JSON:', parseError);
        throw new Error('Failed to parse receipt data from AI response');
      }
      
      // Update processing log with extracted data
      await supabase
        .from('receipt_processing_log')
        .update({
          extracted_data: receiptData,
          processing_status: 'extracted',
          ai_response: aiResponse
        })
        .eq('id', processingLog.id);
      
      // Use our advanced AI matching system with phone filtering
      console.log('Finding matching opportunities with AI...');
      const jobMatches = await findMatchingJobs(organizationId, receiptData, userApiKey, contactPhone);
      console.log(`Found ${jobMatches.length} AI-powered matches for contact ${contactPhone}`);
      
      // Check for completed job matches if no active matches found
      let finalMatches = jobMatches;
      let matchType = 'active';
      
      if (jobMatches.length === 0) {
        console.log('No active job matches, checking completed jobs...');
        const completedMatches = await findCompletedJobMatches(organizationId, receiptData, userApiKey, contactPhone);
        if (completedMatches.length > 0) {
          finalMatches = completedMatches;
          matchType = 'completed';
        }
      }
      
      console.log(`Found ${finalMatches.length} potential opportunity matches`);
      
      // Update processing log with matches
      await supabase
        .from('receipt_processing_log')
        .update({
          potential_matches: finalMatches.map(m => ({
            opportunity_id: m.opportunityId,
            opportunity_name: m.opportunityName,
            contact_name: m.contactName,
            confidence: m.confidence,
            reason: m.reason
          })),
          match_type: matchType,
          processing_status: 'matched'
        })
        .eq('id', processingLog.id);
      
      // Generate response message based on matches
      const amount = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(receiptData.amount);
      
      let responseMessage = '';
      
      if (finalMatches.length === 0) {
        responseMessage = `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}.\n\nNo matching jobs found. Which job should this expense be logged to? Please reply with the job name.`;
      } else if (finalMatches.length === 1 && finalMatches[0].confidence > 70) {
        const match = finalMatches[0];
        const jobLabel = matchType === 'completed' ? ' (COMPLETED JOB)' : '';
        responseMessage = `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}.\n\nIs this for "${match.opportunityName}"${jobLabel}? Reply YES to confirm or specify the correct job.`;
      } else {
        const jobLabel = matchType === 'completed' ? ' completed' : '';
        responseMessage = `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}.\n\nFound ${finalMatches.length}${jobLabel} possible jobs:\n`;
        finalMatches.slice(0, 3).forEach((match, index) => {
          const label = matchType === 'completed' ? ' (COMPLETED)' : '';
          responseMessage += `${index + 1}. ${match.opportunityName}${label} - ${match.confidence}% match\n`;
        });
        responseMessage += '\nReply with the number or job name to confirm.';
      }
      
      // Send response message via GHL
      console.log('Generated response message:', responseMessage);
      
      await supabase
        .from('receipt_processing_log')
        .update({
          response_message: responseMessage,
          processing_status: 'response_ready'
        })
        .eq('id', processingLog.id);
      
      // Send the response message via GHL
      try {
        const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processingLogId: processingLog.id,
            responseMessage,
            phoneNumber: contactPhone
          })
        });
        
        if (sendResponse.ok) {
          console.log('Response message sent successfully via GHL');
          await supabase
            .from('receipt_processing_log')
            .update({
              processing_status: 'response_sent'
            })
            .eq('id', processingLog.id);
        } else {
          console.error('Failed to send response message via GHL');
        }
      } catch (sendError) {
        console.error('Error sending response message:', sendError);
      }
      
      // Mark the original message as processed
      await supabase
        .from('incoming_messages')
        .update({
          processed: true,
          receipt_processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      return NextResponse.json({
        success: true,
        extractedData: receiptData,
        matchCount: finalMatches.length,
        matchType,
        responseMessage,
        processingLogId: processingLog.id
      });
      
    } catch (processingError: any) {
      console.error('Error processing receipt:', processingError);
      
      // Update processing log with error
      if (processingLog) {
        await supabase
          .from('receipt_processing_log')
          .update({
            processing_status: 'error',
            error_message: processingError.message
          })
          .eq('id', processingLog.id);
      }
      
      return NextResponse.json({ 
        error: 'Receipt processing failed',
        details: processingError.message 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in process-from-message endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

async function sendApiKeyRequiredMessage(phoneNumber: string, integrationId: string, userId: string, organizationId: string) {
  const message = `To process receipts automatically, I need access to an AI service. Please add your OpenAI API key in the settings at ${process.env.NEXT_PUBLIC_APP_URL}/settings/api-keys\n\nOnce added, simply resend your receipt and I'll process it for you!`;
  
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages/send-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processingLogId: 'api-key-required',
        responseMessage: message,
        phoneNumber
      })
    });
  } catch (error) {
    console.error('Error sending API key required message:', error);
  }
}