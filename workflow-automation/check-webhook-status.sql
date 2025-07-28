-- Check if any messages were received recently
SELECT 
    id,
    phone_number,
    message_type,
    body,
    has_receipt,
    direction,
    created_at,
    processed,
    receipt_processed
FROM incoming_messages
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- Check receipt processing logs
SELECT 
    id,
    phone_number,
    processing_status,
    extracted_data,
    potential_matches,
    match_type,
    error_message,
    created_at
FROM receipt_processing_log
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- Check if the phone number is registered as a team member
SELECT 
    id,
    ghl_user_id,
    ghl_user_name,
    ghl_user_phone,
    phone
FROM user_payment_structures
WHERE user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5';