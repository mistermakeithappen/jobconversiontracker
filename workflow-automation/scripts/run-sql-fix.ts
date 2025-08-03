import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSqlFix() {
  console.log('🔧 Applying reimbursable trigger fix via SQL...');
  
  // For now, let's manually test the correct logic by creating receipts and checking
  // The SQL fix needs to be applied manually in the Supabase dashboard
  
  console.log('📝 Manual fix required:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Run this SQL:');
  console.log(`
CREATE OR REPLACE FUNCTION auto_determine_reimbursable()
RETURNS TRIGGER AS $$$ 
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
      NEW.reimbursable = true;  -- FIXED: was false, now true for personal cards
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
$$$ LANGUAGE plpgsql;
  `);
  
  console.log('\\n⚠️ For now, I'll implement a workaround in the API to handle this logic');
}

runSqlFix().catch(console.error);