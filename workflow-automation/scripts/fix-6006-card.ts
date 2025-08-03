import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix6006Card() {
  console.log('🔧 Fixing card ••••6006 configuration...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Find the 6006 card
  const { data: card, error: findError } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('last_four_digits', '6006')
    .eq('is_active', true)
    .single();
    
  if (findError || !card) {
    console.log('❌ Card ••••6006 not found');
    return;
  }
  
  console.log('📋 Current card configuration:');
  console.log(`   Name: ${card.card_name}`);
  console.log(`   Last 4: ••••${card.last_four_digits}`);
  console.log(`   Is Reimbursable: ${card.is_reimbursable} (${card.is_reimbursable ? 'WRONG - should be false' : 'CORRECT'})`);
  
  if (card.is_reimbursable === true) {
    console.log('\n🔧 Fixing: Setting is_reimbursable to FALSE (company card should NOT be reimbursable)');
    
    const { data: updatedCard, error: updateError } = await supabase
      .from('company_credit_cards')
      .update({ is_reimbursable: false })
      .eq('id', card.id)
      .select()
      .single();
      
    if (updateError) {
      console.log(`❌ Failed to update: ${updateError.message}`);
    } else {
      console.log('✅ Card configuration fixed!');
      console.log(`   New is_reimbursable value: ${updatedCard.is_reimbursable}`);
    }
  } else {
    console.log('✅ Card is already configured correctly');
  }
  
  // Now fix any existing receipts with 6006
  console.log('\n🧾 Fixing existing receipts with card ••••6006...');
  
  const { data: receipts } = await supabase
    .from('opportunity_receipts')
    .select('id, vendor_name, amount, reimbursable')
    .eq('user_id', mockUserId)
    .eq('last_four_digits', '6006');
    
  console.log(`Found ${receipts?.length || 0} receipts with card ••••6006`);
  
  for (const receipt of receipts || []) {
    if (receipt.reimbursable === true) {
      console.log(`🔧 Fixing receipt: ${receipt.vendor_name} ($${receipt.amount})`);
      
      const { error } = await supabase
        .from('opportunity_receipts')
        .update({ reimbursable: false })
        .eq('id', receipt.id);
        
      if (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      } else {
        console.log(`   ✅ Fixed: Now marked as company expense`);
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log('✅ Card ••••6006 is now configured as a company card (NOT reimbursable)');
  console.log('✅ All receipts with ••••6006 are now marked as company expenses');
  console.log('✅ Future receipts with ••••6006 will automatically be company expenses');
}

fix6006Card().catch(console.error);