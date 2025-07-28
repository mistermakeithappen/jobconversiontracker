-- First, check what phone numbers are currently configured
SELECT 
    id,
    user_id,
    ghl_user_id,
    ghl_user_name,
    ghl_user_phone,
    phone
FROM user_payment_structures
WHERE user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

-- If you need to add or update the phone number, use this:
-- UPDATE user_payment_structures
-- SET ghl_user_phone = '+1234567890'  -- Replace with your actual phone number
-- WHERE user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5'
-- AND id = 'YOUR_PAYMENT_STRUCTURE_ID';  -- Replace with the actual ID from the query above