import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import ApiKeyManager from '@/lib/utils/api-key-manager';
import OpenAI from 'openai';
import { FileConverter } from '@/lib/utils/file-converter';
import { findMatchingJobs, findCompletedJobMatches, type ReceiptData, type JobMatch } from '@/lib/services/receipt-matching';

// Types are now imported from the shared service

const supabase = getServiceSupabase();

export async function POST(request: NextRequest) {
  console.log('=== Receipt Processing API Called ===');
  try {
    const formData = await request.formData();
    const imageFile = formData.get('file') || formData.get('image') as File;
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
    
    if (!imageFile) {
      console.error('No image file found in form data');
      return NextResponse.json({ 
        success: false,
        error: 'No image provided',
        details: 'Image file was not found in the form data'
      }, { status: 400 });
    }

    console.log('Processing receipt image from:', userPhone || userEmail || 'user upload');
    console.log('Original file type:', imageFile.type, 'size:', imageFile.size);

    // Step 1: Validate and convert file to PNG
    const validation = FileConverter.validateFile(imageFile);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const conversionResult = await FileConverter.convertToPNG(imageFile);
    if (!conversionResult.success || !conversionResult.pngBuffer) {
      return NextResponse.json({ 
        error: conversionResult.error || 'File conversion failed' 
      }, { status: 400 });
    }

    // Create optimized PNG data URL for OpenAI
    const imageDataUrl = FileConverter.createPNGDataURL(conversionResult.pngBuffer);
    console.log(`Converted ${conversionResult.originalFormat} to PNG (${conversionResult.pngBuffer.length} bytes)`);

    // Step 1: Find user by phone/email first to get their API key
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

    // Step 2: Get user's OpenAI API key
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

    // Step 3: Extract receipt data using user's OpenAI API key
    const receiptData = await extractReceiptData(imageDataUrl, userApiKey);
    console.log('Extracted receipt data:', receiptData);

    // Step 4: Find matching opportunities with pipeline intelligence
    // Extract contact phone from form data if available
    const contactPhone = formData.get('contactPhone') as string;
    const contactId = formData.get('contactId') as string;
    
    const jobMatches = await findMatchingJobs(user.userId, receiptData, userApiKey, contactPhone, contactId);
    console.log('Found job matches:', jobMatches);

    // Step 5: Determine response based on matches
    let response = await generateResponse(receiptData, jobMatches, user);
    
    // Step 5b: If no matches found, check completed jobs as fallback
    if (jobMatches.length === 0 && response.type === 'no_match') {
      console.log('No matches in active stages, checking completed jobs...');
      const completedMatches = await findCompletedJobMatches(user.userId, receiptData, userApiKey, contactPhone, contactId);
      if (completedMatches.length > 0) {
        response = await generateCompletedJobResponse(receiptData, completedMatches, user);
      }
    }

    // Step 6: Store the processing record
    await storeReceiptProcessing(user.userId, receiptData, jobMatches, response);

    return NextResponse.json({
      success: true,
      receiptData,
      jobMatches,
      response,
      nextAction: jobMatches.length === 1 ? 'auto_confirm' : 'user_select'
    });

  } catch (error) {
    console.error('Error processing receipt image:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process receipt image',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'UnknownError'
    }, { status: 500 });
  }
}

async function extractReceiptData(imageDataUrl: string, apiKey: string): Promise<ReceiptData> {
  const openai = new OpenAI({
    apiKey: apiKey
  });
  
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

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI Vision API');
  }

  console.log('Raw OpenAI response:', content);

  try {
    // Try to extract JSON from the response (in case it's wrapped in markdown or other text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    const receiptData = JSON.parse(jsonString);
    
    // Validate and clean the data
    return {
      vendor_name: receiptData.vendor_name || 'Unknown Vendor',
      amount: parseFloat(receiptData.amount) || 0,
      receipt_date: receiptData.receipt_date || new Date().toISOString().split('T')[0],
      description: receiptData.description || null,
      receipt_number: receiptData.receipt_number || null,
      category: receiptData.category || 'Other',
      confidence: Math.min(100, Math.max(0, parseInt(receiptData.confidence) || 0))
    };
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', content);
    console.error('Parse error:', parseError);
    throw new Error(`Failed to parse receipt data from AI response. Raw response: ${content.substring(0, 200)}...`);
  }
}

async function findUserByContact(phone?: string, email?: string) {
  // In a real implementation, this would query your user database
  // For now, we'll use mock auth and check against GHL contacts
  
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

async function generateCompletedJobResponse(receiptData: ReceiptData, jobMatches: JobMatch[], user: any) {
  const amount = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(receiptData.amount);

  const matchList = jobMatches.slice(0, 3).map((match, index) => 
    `${index + 1}) ${match.opportunityName} (${match.confidence}% match - COMPLETED JOB)`
  ).join('\n');

  return {
    message: `Receipt processed! Found ${amount} from ${receiptData.vendor_name} on ${receiptData.receipt_date}. This appears to be for a completed job:\n\n${matchList}\n\nReply with the number to assign to a completed job, or "NEW" if this is for a current active job not listed.`,
    type: 'completed_job_matches',
    needsSelection: true,
    options: jobMatches.slice(0, 3)
  };
}

async function storeReceiptProcessing(userId: string, receiptData: ReceiptData, jobMatches: JobMatch[], response: any) {
  // Store the receipt processing record for follow-up
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