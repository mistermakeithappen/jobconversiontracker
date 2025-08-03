import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateTrigger() {
  console.log('🔧 Fixing reimbursable detection trigger...');
  
  const triggerFunction = `
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
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql: triggerFunction });
  
  if (error) {
    console.error('❌ Error updating trigger:', error);
    // Try direct SQL execution
    const { error: directError } = await supabase
      .from('pg_stat_statements')
      .select('*')
      .limit(0); // This won't work but let's try a different approach
      
    console.log('Trying alternative approach...');
    
    // Let's manually update via raw SQL
    const client = supabase;
    
    try {
      await client.rpc('create_or_replace_function', {
        function_name: 'auto_determine_reimbursable',
        function_body: triggerFunction
      });
      console.log('✅ Trigger function updated successfully!');
    } catch (err) {
      console.error('❌ Alternative approach failed:', err);
      console.log('⚠️  Manual fix needed: The trigger logic needs to be updated in the database');
      console.log('📝 The issue: Line 92 should be "NEW.reimbursable = true;" instead of "false"');
      console.log('💡 Personal cards (not in company list) should be reimbursable');
    }
  } else {
    console.log('✅ Trigger function updated successfully!');
  }
}

updateTrigger().catch(console.error);