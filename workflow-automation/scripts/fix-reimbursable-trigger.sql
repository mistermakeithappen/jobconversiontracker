-- Fix the reimbursable detection trigger logic
-- The issue: personal cards (not found in company_credit_cards) should be reimbursable=true
-- Company cards (found in company_credit_cards with is_reimbursable=false) should be reimbursable=false

CREATE OR REPLACE FUNCTION auto_determine_reimbursable()
RETURNS TRIGGER AS $$
BEGIN
  -- If last_four_digits is provided, check against company credit cards
  IF NEW.last_four_digits IS NOT NULL THEN
    -- Look up the card in company_credit_cards table
    SELECT is_reimbursable INTO NEW.reimbursable
    FROM company_credit_cards 
    WHERE last_four_digits = NEW.last_four_digits 
    AND is_active = true
    LIMIT 1;
    
    -- If no matching card found, it's a personal card = REIMBURSABLE
    IF NEW.reimbursable IS NULL THEN
      NEW.reimbursable = true;
    END IF;
  ELSE
    -- For non-credit card payments, default based on payment method
    CASE NEW.payment_method
      WHEN 'cash' THEN NEW.reimbursable = true;
      WHEN 'check' THEN NEW.reimbursable = true;
      ELSE NEW.reimbursable = false;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;