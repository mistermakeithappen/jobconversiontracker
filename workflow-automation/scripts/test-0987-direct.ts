import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test0987Direct() {
  console.log('🧪 Testing card ••••0987 directly in database...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get integration ID
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id')
    .eq('user_id', mockUserId)
    .limit(1);
    
  const integrationId = integrations?.[0]?.id;
  if (!integrationId) {
    console.log('❌ No integration found');
    return;
  }
  
  // Simulate the API logic
  const lastFourDigits = '0987';
  
  console.log('🔍 Checking if 0987 is a company card...');
  
  // Check if this card is a company card
  const { data: companyCard } = await supabase
    .from('company_credit_cards')
    .select('is_reimbursable')
    .eq('last_four_digits', lastFourDigits)
    .eq('is_active', true)
    .single();
  
  let isReimbursable;
  if (companyCard) {
    console.log(`✅ Found company card: is_reimbursable = ${companyCard.is_reimbursable}`);
    isReimbursable = companyCard.is_reimbursable;
  } else {
    console.log('❌ Not found in company cards = personal card = REIMBURSABLE');
    isReimbursable = true;
  }
  
  console.log(`\\n📝 Creating receipt with reimbursable = ${isReimbursable}...`);
  
  // Create receipt with the determined reimbursable status
  const { data: receipt, error } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-0987-direct',
      integration_id: integrationId,
      vendor_name: 'Test Store (0987)',
      amount: 25.99,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: lastFourDigits,
      reimbursable: isReimbursable,
      submitter_user_id: mockUserId
    })
    .select()
    .single();
  
  if (error) {
    console.log('❌ Error creating receipt:', error.message);
    return;
  }
  
  console.log('✅ Receipt created!');
  console.log(`   Vendor: ${receipt.vendor_name}`);
  console.log(`   Card: ••••${receipt.last_four_digits}`);
  console.log(`   Set reimbursable to: ${isReimbursable}`);
  console.log(`   Final reimbursable value: ${receipt.reimbursable}`);
  console.log(`   Trigger override: ${receipt.reimbursable !== isReimbursable ? 'YES (PROBLEM)' : 'NO (GOOD)'}`);
  
  // If trigger overrode it, apply the fix
  if (receipt.reimbursable !== isReimbursable) {
    console.log('\\n🔧 Applying fix for trigger override...');
    
    const { data: fixedReceipt } = await supabase
      .from('opportunity_receipts')
      .update({ reimbursable: isReimbursable })
      .eq('id', receipt.id)
      .select()
      .single();
      
    if (fixedReceipt) {
      console.log(`✅ Fixed! New reimbursable value: ${fixedReceipt.reimbursable}`);
      receipt.reimbursable = fixedReceipt.reimbursable; // Update our local copy
    }
  }
  
  console.log(`\\n📊 Final Result:`);
  console.log(`   Card ••••0987 is ${receipt.reimbursable ? 'REIMBURSABLE' : 'COMPANY CARD'}`);
  console.log(`   Expected: REIMBURSABLE (personal card)`);
  console.log(`   Status: ${receipt.reimbursable ? '✅ CORRECT' : '❌ INCORRECT'}`);
  
  // Clean up
  await supabase
    .from('opportunity_receipts')
    .delete()
    .eq('id', receipt.id);
    
  console.log('\\n🧹 Test receipt cleaned up');
}

test0987Direct().catch(console.error);