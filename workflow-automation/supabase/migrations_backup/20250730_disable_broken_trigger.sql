-- Disable the broken reimbursable detection trigger
-- The trigger has incorrect logic and is overriding our API settings

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_auto_determine_reimbursable ON opportunity_receipts;

-- Drop the function as well to fully disable it
DROP FUNCTION IF EXISTS auto_determine_reimbursable();

-- Create a corrected function (optional - we'll handle logic in API)
CREATE OR REPLACE FUNCTION fix_all_reimbursable_status()
RETURNS void AS $$
BEGIN
  -- Fix all existing receipts with correct logic
  UPDATE opportunity_receipts 
  SET reimbursable = CASE 
    -- If card is found in company_credit_cards, use its is_reimbursable value
    WHEN last_four_digits IN (
      SELECT cc.last_four_digits 
      FROM company_credit_cards cc
      WHERE cc.is_active = true
    ) THEN (
      SELECT cc.is_reimbursable 
      FROM company_credit_cards cc
      WHERE cc.last_four_digits = opportunity_receipts.last_four_digits 
      AND cc.is_active = true 
      LIMIT 1
    )
    -- If card not found in company cards = personal card = reimbursable
    WHEN last_four_digits IS NOT NULL THEN true  
    -- Cash and check payments = reimbursable
    WHEN payment_method = 'cash' THEN true
    WHEN payment_method = 'check' THEN true
    -- Other payment methods = not reimbursable
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- Run the fix function immediately
SELECT fix_all_reimbursable_status();

-- Comment explaining the change
COMMENT ON FUNCTION fix_all_reimbursable_status() IS 'One-time function to fix reimbursable status after removing broken trigger. API now handles the logic.';

-- Note: The API at /api/receipts now handles reimbursable determination
-- No trigger is needed as we do the logic server-side