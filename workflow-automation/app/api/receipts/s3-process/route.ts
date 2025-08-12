import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';
import OpenAI from 'openai';
import { WebFileConverter } from '@/lib/utils/web-file-converter';
import { createS3Service, S3Service, type FileMetadata } from '@/lib/services/s3-service';
import { findMatchingJobs, findCompletedJobMatches, type ReceiptData, type JobMatch } from '@/lib/services/receipt-matching';

const supabase = getServiceSupabase();

export async function POST(request: NextRequest) {
  console.log('=== S3 Receipt Processing API Called ===');
  
  try {
    const formData = await request.formData();
    const imageFile = formData.get('file') || formData.get('image');
    const userPhone = formData.get('userPhone') as string;
    const userEmail = formData.get('userEmail') as string;
    const opportunityId = formData.get('opportunityId') as string;
    const integrationId = formData.get('integrationId') as string;
    
    console.log('Form data received:', {
      hasImage: !!imageFile,
      imageFieldName: formData.has('file') ? 'file' : formData.has('image') ? 'image' : 'none',
      userPhone,
      userEmail,
      opportunityId,
      integrationId
    });
    
    if (!imageFile || !(imageFile instanceof File)) {
      console.error('No valid image file found in form data');
      return NextResponse.json({ 
        success: false,
        error: 'No valid image file provided',
        details: 'Image file was not found or is not a valid file in the form data'
      }, { status: 400 });
    }

    console.log('Processing receipt image from:', userPhone || userEmail || 'user upload');
    console.log('Original file type:', imageFile.type, 'size:', imageFile.size);

    // Step 1: Validate file
    const validation = WebFileConverter.validateFile(imageFile);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Step 2: Find user by phone/email to get their API key
    console.log('Finding user by contact:', { userPhone, userEmail });
    const user = await findUserByContact(userPhone, userEmail);
    if (!user) {
      console.error('User not found for phone/email:', { userPhone, userEmail });
      return NextResponse.json({ 
        success: false,
        error: 'User not found or not authorized',
        details: 'This phone number/email is not associated with an authorized account.'
      }, { status: 403 });
    }
    console.log('User found:', user.userId);

    // Step 3: Get user's OpenAI API key
    console.log('Getting OpenAI API key for user:', user.userId);
    const userApiKey = await ApiKeyManager.getApiKey(user.userId, 'openai');
    if (!userApiKey) {
      console.error('No OpenAI API key found for user:', user.userId);
      return NextResponse.json({ 
        success: false,
        error: 'No OpenAI API key found',
        details: 'Please add your OpenAI API key in the settings to use AI receipt processing.'
      }, { status: 400 });
    }
    console.log('OpenAI API key retrieved successfully');

    // Step 4: Convert image to PNG using web-compatible converter
    console.log('Converting image to PNG...');
    const conversionResult = await WebFileConverter.convertToPNG(imageFile);
    if (!conversionResult.success || !conversionResult.pngDataUrl) {
      return NextResponse.json({ 
        error: conversionResult.error || 'File conversion failed' 
      }, { status: 400 });
    }
    console.log('Image converted successfully');

    // Step 5: Upload to S3
    console.log('Uploading to S3...');
    const s3Service = createS3Service();
    
    const fileMetadata: FileMetadata = {
      originalName: imageFile.name,
      mimeType: 'image/png',
      size: imageFile.size,
      userId: user.userId,
      organizationId: user.locationId,
      category: 'receipts'
    };

    const s3Key = S3Service.generateKey(fileMetadata);
    const base64Data = WebFileConverter.extractBase64FromDataUrl(conversionResult.pngDataUrl);
    const buffer = WebFileConverter.base64ToBuffer(base64Data);

    const uploadResult = await s3Service.uploadFile(
      s3Key,
      buffer,
      'image/png',
      {
        originalName: imageFile.name,
        originalType: imageFile.type,
        userId: user.userId,
        organizationId: user.locationId
      }
    );

    if (!uploadResult.success) {
      return NextResponse.json({ 
        error: 'Failed to upload to S3',
        details: uploadResult.error 
      }, { status: 500 });
    }
    console.log('File uploaded to S3:', s3Key);

    // Step 6: Extract receipt data using OpenAI
    const receiptData = await extractReceiptData(conversionResult.pngDataUrl, userApiKey);
    console.log('Extracted receipt data:', receiptData);

    // Step 7: Find matching opportunities
    const contactPhone = formData.get('contactPhone') as string;
    const contactId = formData.get('contactId') as string;
    
    const jobMatches = await findMatchingJobs(user.locationId, receiptData, userApiKey, contactPhone);
    console.log('Found job matches:', jobMatches);

    // Step 8: Generate response
    let response = await generateResponse(receiptData, jobMatches, user);
    
    // Step 9: Store receipt record in database
    const receiptRecord = {
      organization_id: user.locationId,
      opportunity_id: opportunityId || 'temp_' + Date.now().toString(),
      contact_id: null,
      amount: parseFloat(receiptData.amount) || 0,
      receipt_date: receiptData.receipt_date || new Date().toISOString().split('T')[0],
      receipt_type: 'expense',
      category: receiptData.category || 'Other',
      description: receiptData.description || null,
      image_url: uploadResult.url,
      thumbnail_url: uploadResult.url,
      is_reimbursable: false,
      reimbursement_status: 'pending',
      team_member_id: null,
      submitted_by_name: null,
      submitted_by_phone: userPhone || null,
      ai_extracted_data: {
        vendor_name: receiptData.vendor_name || 'Unknown Vendor',
        receipt_number: receiptData.receipt_number || null,
        confidence: Math.min(100, Math.max(0, parseInt(receiptData.confidence) || 0)),
        s3_key: s3Key,
        original_filename: imageFile.name,
        original_mime_type: imageFile.type,
        processed_mime_type: 'image/png',
        file_size: imageFile.size
      },
      ai_confidence_score: Math.min(1, Math.max(0, (parseInt(receiptData.confidence) || 0) / 100)),
      manual_review_required: false,
      company_card_id: null,
      is_company_card_expense: false,
      metadata: {
        integration_id: integrationId || null,
        source: 'web_upload',
        ai_processed: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.userId.toString()
    };

    const { data: receipt, error: receiptError } = await supabase
      .from('opportunity_receipts')
      .insert([receiptRecord])
      .select()
      .single();

    if (receiptError) {
      console.error('Failed to store receipt:', receiptError);
      // Continue anyway, don't fail the whole request
    }

    // Step 10: Store processing log
    await storeReceiptProcessing(user.userId.toString(), receiptData, jobMatches, response);

    return NextResponse.json({
      success: true,
      message: response.message,
      type: response.type,
      needsJobSelection: response.needsJobSelection,
      needsConfirmation: response.needsConfirmation,
      needsSelection: response.needsSelection,
      suggestedJobId: response.suggestedJobId,
      options: response.options,
      receipt_id: receipt?.id,
      s3_url: uploadResult.url
    });

  } catch (error) {
    console.error('S3 receipt processing error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process receipt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions (same as before but adapted for S3)
async function extractReceiptData(imageDataUrl: string, apiKey: string): Promise<ReceiptData> {
  const openai = new OpenAI({ apiKey });
  
  const prompt = `Extract receipt information from this image. Return ONLY a JSON object with these fields:
  {
    "vendor_name": "string",
    "amount": "number as string",
    "receipt_date": "YYYY-MM-DD",
    "description": "string",
    "receipt_number": "string",
    "category": "string",
    "confidence": "number 0-100"
  }`;

  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageDataUrl }
          }
        ]
      }
    ],
    max_tokens: 500
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error(`Failed to parse receipt data from AI response. Raw response: ${content.substring(0, 200)}...`);
  }
}

async function findUserByContact(phone?: string, email?: string) {
  if (!phone && !email) {
    return null;
  }

  // For development, we'll accept any contact and return mock user
  // In production, you'd verify the phone/email against GHL contacts
  return {
    userId: 'af8ba507-b380-4da8-a1e2-23adee7497d5', // Mock user ID
    phone,
    email,
    locationId: 'VgOeEyKgYl9vAS8IcFLx' // Mock location ID
  };
}

async function generateResponse(receiptData: ReceiptData, jobMatches: JobMatch[], user: any) {
  const amount = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(receiptData.amount);

  if (jobMatches.length === 0) {
    return {
      message: `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}. No matching jobs found. Please specify which job this expense belongs to.`,
      type: 'no_match',
      needsJobSelection: true
    };
  }

  if (jobMatches.length === 1) {
    const match = jobMatches[0];
    return {
      message: `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}. This looks like it belongs to "${match.opportunityName}". Reply "YES" to confirm or "NO" to select a different job.`,
      type: 'single_match',
      needsConfirmation: true,
      suggestedJobId: match.opportunityId
    };
  }

  const matchList = jobMatches.slice(0, 3).map((match, index) => 
    `${index + 1}) ${match.opportunityName} (${match.confidence}% match)`
  ).join('\n');

  return {
    message: `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}. Multiple jobs found:\n\n${matchList}\n\nReply with the number (1, 2, 3) to select the correct job.`,
    type: 'multiple_matches',
    needsSelection: true,
    options: jobMatches.slice(0, 3)
  };
}

async function storeReceiptProcessing(userId: string, receiptData: ReceiptData, jobMatches: JobMatch[], response: any) {
  await supabase
    .from('receipt_processing_log')
    .insert({
      user_id: userId,
      receipt_data: receiptData,
      job_matches: jobMatches,
      response_sent: response,
      status: 'pending_user_response',
      created_at: new Date().toISOString()
    });
} 