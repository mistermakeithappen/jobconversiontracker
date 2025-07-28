-- Check incoming messages with more details
SELECT 
    id,
    phone_number,
    message_type,
    LEFT(body, 100) as body_preview,
    has_receipt,
    direction,
    jsonb_array_length(attachments) as attachment_count,
    attachments,
    created_at,
    processed,
    receipt_processed,
    ghl_message_id,
    ghl_conversation_id
FROM incoming_messages
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 10;

-- Check if ngrok URL is hitting the API
-- This will show any errors from receipt processing
SELECT 
    id,
    phone_number,
    processing_status,
    error_message,
    attachment_url,
    LEFT(ai_response, 200) as ai_response_preview,
    extracted_data,
    created_at
FROM receipt_processing_log
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 10;