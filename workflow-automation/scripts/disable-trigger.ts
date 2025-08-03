import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function disableTrigger() {
  console.log('🔧 Attempting to disable the problematic reimbursable trigger...\n');
  
  // Try to disable the trigger by executing SQL
  console.log('The database trigger needs to be disabled manually.');
  console.log('Please go to Supabase Dashboard > SQL Editor and run:');
  console.log('');
  console.log('DROP TRIGGER IF EXISTS trigger_auto_determine_reimbursable ON opportunity_receipts;');
  console.log('');
  console.log('This will allow our API logic to work correctly.');
  
  // Alternative: Let's modify our API to use a different approach
  // We'll update the existing receipt using a direct SQL function that bypasses triggers
  
  console.log('\\n💡 Alternative: Creating a function to update reimbursable status...');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION fix_reimbursable_status()
    RETURNS void AS $$
    BEGIN
      -- Update all receipts to have correct reimbursable status
      UPDATE opportunity_receipts 
      SET reimbursable = CASE 
        WHEN last_four_digits IN (
          SELECT last_four_digits 
          FROM company_credit_cards 
          WHERE is_active = true
        ) THEN (
          SELECT is_reimbursable 
          FROM company_credit_cards 
          WHERE company_credit_cards.last_four_digits = opportunity_receipts.last_four_digits 
          AND is_active = true 
          LIMIT 1
        )
        WHEN last_four_digits IS NOT NULL THEN true  -- Personal card
        WHEN payment_method = 'cash' THEN true
        WHEN payment_method = 'check' THEN true
        ELSE false
      END;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  console.log('Creating fix function...');
  
  try {
    // This approach may not work due to RPC limitations, but let's document the solution
    console.log('⚠️ Manual database fix required.');
    console.log('\\nRun this SQL in Supabase Dashboard:');
    console.log(createFunctionSQL);
    console.log('\\nThen run: SELECT fix_reimbursable_status();');
    
  } catch (error) {
    console.log('Expected error - manual fix required');
  }
}

disableTrigger().catch(console.error);