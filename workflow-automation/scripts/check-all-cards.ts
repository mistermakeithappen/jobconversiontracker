import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllCards() {
  console.log('📋 Checking ALL company credit cards (active and inactive)...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get ALL cards
  const { data: allCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .order('created_at', { ascending: false });
    
  console.log('📋 All Company Cards in Database:');
  allCards?.forEach(card => {
    console.log(`  ${card.card_name} (••••${card.last_four_digits}):`);
    console.log(`    Active: ${card.is_active}`);
    console.log(`    Reimbursable: ${card.is_reimbursable}`);
    console.log(`    Created: ${new Date(card.created_at).toLocaleString()}`);
    console.log('  ---');
  });
  
  // Get active cards only
  const { data: activeCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('\\n✅ ACTIVE Company Cards (what system uses):');
  activeCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.card_name} - ${card.is_reimbursable ? 'REIMBURSABLE ❌ WRONG' : 'NOT REIMBURSABLE ✅ CORRECT'}`);
  });
  
  // Check if we need to restore the standard company cards
  const expectedCompanyCards = ['1234', '5678', '9999'];
  const activeCardNumbers = activeCards?.map(card => card.last_four_digits) || [];
  const missingCards = expectedCompanyCards.filter(num => !activeCardNumbers.includes(num));
  
  if (missingCards.length > 0) {
    console.log('\\n⚠️  Missing expected company cards:', missingCards.map(num => `••••${num}`).join(', '));
    console.log('\\n🔧 Do you want me to restore the standard company cards?');
    console.log('   This will add cards ••••1234, ••••5678, ••••9999 as company cards (NOT reimbursable)');
    
    // Let's restore them automatically
    console.log('\\n🔧 Restoring standard company cards...');
    
    const cardsToCreate = [
      { name: 'Company Amex Business', last_four: '1234', type: 'American Express' },
      { name: 'Company Visa Corporate', last_four: '5678', type: 'Visa' },
      { name: 'Fleet Fuel Card', last_four: '9999', type: 'Other' }
    ];
    
    for (const cardInfo of cardsToCreate) {
      if (missingCards.includes(cardInfo.last_four)) {
        console.log(`   Adding ${cardInfo.name} (••••${cardInfo.last_four})`);
        
        const { error } = await supabase
          .from('company_credit_cards')
          .insert({
            user_id: mockUserId,
            card_name: cardInfo.name,
            last_four_digits: cardInfo.last_four,
            card_type: cardInfo.type,
            is_reimbursable: false, // Company cards are NEVER reimbursable
            is_active: true
          });
          
        if (error) {
          console.log(`     ❌ Failed: ${error.message}`);
        } else {
          console.log(`     ✅ Added!`);
        }
      }
    }
  }
  
  // Final check
  const { data: finalCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true)
    .order('last_four_digits');
    
  console.log('\\n📊 Final Active Company Cards:');
  finalCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.card_name} (${card.is_reimbursable ? 'REIMBURSABLE ❌' : 'NOT REIMBURSABLE ✅'})`);
  });
  
  console.log('\\n💡 Logic Summary:');
  console.log('   Company cards in database = Company pays = NOT reimbursable (green badge)');
  console.log('   Personal cards not in database = Employee pays = REIMBURSABLE (red badge)');
}

checkAllCards().catch(console.error);