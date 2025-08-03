import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixExistingReceipts() {
  console.log('🔧 Fixing existing receipts with incorrect reimbursable status...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get all company cards
  const { data: companyCards } = await supabase
    .from('company_credit_cards')
    .select('last_four_digits, is_reimbursable')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('📋 Company Cards:');
  companyCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.is_reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
  });
  
  // Get all receipts with credit card payments
  const { data: receipts } = await supabase
    .from('opportunity_receipts')
    .select('id, last_four_digits, reimbursable, vendor_name, amount')
    .eq('user_id', mockUserId)
    .neq('last_four_digits', null);
    
  console.log(`\\n🧾 Found ${receipts?.length || 0} receipts with card payments`);
  
  let fixedCount = 0;
  
  for (const receipt of receipts || []) {
    // Determine what the reimbursable status should be
    const companyCard = companyCards?.find(card => card.last_four_digits === receipt.last_four_digits);
    const shouldBeReimbursable = companyCard ? companyCard.is_reimbursable : true;
    
    console.log(`   Checking ••••${receipt.last_four_digits}: ${companyCard ? `Found in company cards (${companyCard.is_reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'})` : `Not found = personal card (REIMBURSABLE)`}`);
    
    if (receipt.reimbursable !== shouldBeReimbursable) {
      console.log(`\\n🔧 Fixing receipt: ${receipt.vendor_name} ($${receipt.amount})`);
      console.log(`   Card: ••••${receipt.last_four_digits}`);
      console.log(`   Current: ${receipt.reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
      console.log(`   Should be: ${shouldBeReimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
      
      const { error } = await supabase
        .from('opportunity_receipts')
        .update({ reimbursable: shouldBeReimbursable })
        .eq('id', receipt.id);
        
      if (error) {
        console.log(`   ❌ Failed to fix: ${error.message}`);
      } else {
        console.log(`   ✅ Fixed!`);
        fixedCount++;
      }
    }
  }
  
  console.log(`\\n📊 Summary:`);
  console.log(`   Total receipts checked: ${receipts?.length || 0}`);
  console.log(`   Receipts fixed: ${fixedCount}`);
  console.log(`   Receipts already correct: ${(receipts?.length || 0) - fixedCount}`);
  
  if (fixedCount > 0) {
    console.log('\\n✅ Reimbursable status corrections completed!');
  } else {
    console.log('\\n✅ All receipts already have correct reimbursable status!');
  }
}

fixExistingReceipts().catch(console.error);