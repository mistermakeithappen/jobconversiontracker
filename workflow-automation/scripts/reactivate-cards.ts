import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reactivateCards() {
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  console.log('🔧 Reactivating standard company cards...');
  
  const { data, error } = await supabase
    .from('company_credit_cards')
    .update({ is_active: true })
    .eq('user_id', mockUserId)
    .in('last_four_digits', ['1234', '5678', '9999'])
    .select();
    
  if (error) {
    console.log('❌ Failed:', error.message);
  } else {
    console.log('✅ Reactivated', data.length, 'cards');
    data.forEach(card => {
      console.log(`  ••••${card.last_four_digits}: ${card.card_name}`);
    });
  }
  
  // Check final state
  const { data: finalCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true)
    .order('last_four_digits');
    
  console.log('\n📊 All Active Company Cards:');
  finalCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.card_name} (reimbursable: ${card.is_reimbursable})`);
  });
}

reactivateCards().catch(console.error);