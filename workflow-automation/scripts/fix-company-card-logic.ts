import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixCompanyCardLogic() {
  console.log('🔧 Fixing company card logic - ALL company cards should be NOT reimbursable...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get all company cards
  const { data: allCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('📋 Current Company Cards:');
  allCards?.forEach(card => {
    console.log(`  ${card.card_name} (••••${card.last_four_digits}): is_reimbursable = ${card.is_reimbursable} ${card.is_reimbursable ? '❌ WRONG' : '✅ CORRECT'}`);
  });
  
  // Fix any cards that have is_reimbursable = true (this should never happen for company cards)
  const incorrectCards = allCards?.filter(card => card.is_reimbursable === true) || [];
  
  if (incorrectCards.length > 0) {
    console.log(`\\n🔧 Fixing ${incorrectCards.length} incorrectly configured company cards...`);
    
    for (const card of incorrectCards) {
      console.log(`   Fixing ${card.card_name} (••••${card.last_four_digits})`);
      
      const { error } = await supabase
        .from('company_credit_cards')
        .update({ is_reimbursable: false })
        .eq('id', card.id);
        
      if (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      } else {
        console.log(`   ✅ Fixed: Set to NOT reimbursable`);
      }
    }
  } else {
    console.log('\\n✅ All company cards are already configured correctly');
  }
  
  // Get updated list
  const { data: updatedCards } = await supabase
    .from('company_credit_cards')
    .select('last_four_digits')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  const companyCardNumbers = updatedCards?.map(card => card.last_four_digits) || [];
  
  console.log('\\n📋 Final Company Card Configuration:');
  console.log('Company Cards (NOT reimbursable):');
  companyCardNumbers.forEach(num => {
    console.log(`  ••••${num} = Company Card (green badge)`);
  });
  
  console.log('\\nPersonal Cards (REIMBURSABLE):');
  console.log('  Any other card number = Personal Card (red badge)');
  console.log('  Cash/check payments = Reimbursable (red badge)');
  
  // Test a few scenarios
  console.log('\\n🧪 Testing Logic:');
  
  const testCards = ['1234', '0987', '6006'];
  
  for (const testCard of testCards) {
    const isCompanyCard = companyCardNumbers.includes(testCard);
    const shouldBeReimbursable = !isCompanyCard; // Company cards = false, personal cards = true
    
    console.log(`  ••••${testCard}: ${isCompanyCard ? 'Company Card' : 'Personal Card'} = ${shouldBeReimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
  }
  
  console.log('\\n✅ Company card logic is now correct!');
  console.log('💡 Remember: Company cards in database = NOT reimbursable (company pays)');
  console.log('💡 Remember: Personal cards not in database = REIMBURSABLE (employee pays)');
}

fixCompanyCardLogic().catch(console.error);