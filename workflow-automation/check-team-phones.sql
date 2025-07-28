-- Check which phone numbers are configured for team members
SELECT 
    id,
    user_id,
    ghl_user_id,
    ghl_user_name,
    ghl_user_phone,
    phone
FROM user_payment_structures
WHERE user_id = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
