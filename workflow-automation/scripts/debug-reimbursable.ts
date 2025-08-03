import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugReimbursable() {
  console.log('🔍 Debugging reimbursable detection...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Check what company cards exist
  const { data: companyCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('is_active', true);
    
  console.log('📋 Company Credit Cards:');
  companyCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.card_name} - ${card.is_reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
  });
  
  // Test the logic manually
  const testCard = '4567'; // Should be reimbursable (personal card)
  
  console.log(`\\n🧪 Testing card ••••${testCard}:`);
  
  const { data: foundCard } = await supabase
    .from('company_credit_cards')
    .select('is_reimbursable')
    .eq('last_four_digits', testCard)
    .eq('is_active', true)
    .single();
    
  if (foundCard) {
    console.log(`  ✅ Found in company cards: is_reimbursable = ${foundCard.is_reimbursable}`);
  } else {
    console.log(`  ❌ Not found in company cards - should be REIMBURSABLE (personal card)`);
  }
  
  // Test a company card
  const companyTestCard = '1234';
  console.log(`\\n🧪 Testing company card ••••${companyTestCard}:`);
  
  const { data: foundCompanyCard } = await supabase
    .from('company_credit_cards')
    .select('is_reimbursable')
    .eq('last_four_digits', companyTestCard)
    .eq('is_active', true)
    .single();
    
  if (foundCompanyCard) {
    console.log(`  ✅ Found in company cards: is_reimbursable = ${foundCompanyCard.is_reimbursable}`);
  } else {
    console.log(`  ❌ Not found in company cards - unexpected!`);
  }
}

debugReimbursable().catch(console.error);