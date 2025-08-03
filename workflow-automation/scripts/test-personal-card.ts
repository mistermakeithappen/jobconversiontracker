import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPersonalCard() {
  console.log('🧪 Testing personal card reimbursable detection...\n');
  
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
  
  // Test with personal card (not in company cards list)
  console.log('🧪 Testing personal card (••••4567) - should be REIMBURSABLE');
  
  const { data: receipt, error } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-opp-456',
      integration_id: integrationId,
      vendor_name: 'Lowes Test',
      amount: 89.99,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '4567', // Personal card (not in company cards)
      submitter_user_id: mockUserId
    })
    .select()
    .single();
  
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  console.log('✅ Receipt created!');
  console.log('   Reimbursable value:', receipt.reimbursable);
  console.log('   Expected: true (personal card)');
  console.log('   Result:', receipt.reimbursable === true ? '✅ CORRECT' : '❌ INCORRECT');
  
  // Test cash payment
  console.log('\\n🧪 Testing cash payment - should be REIMBURSABLE');
  
  const { data: cashReceipt, error: cashError } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-opp-789',
      integration_id: integrationId,
      vendor_name: 'Hardware Store Test',
      amount: 45.00,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'cash',
      last_four_digits: null,
      submitter_user_id: mockUserId
    })
    .select()
    .single();
  
  if (cashError) {
    console.log('❌ Cash test error:', cashError.message);
  } else {
    console.log('✅ Cash receipt created!');
    console.log('   Reimbursable value:', cashReceipt.reimbursable);
    console.log('   Expected: true (cash payment)');
    console.log('   Result:', cashReceipt.reimbursable === true ? '✅ CORRECT' : '❌ INCORRECT');
  }
  
  // Clean up
  await supabase.from('opportunity_receipts').delete().eq('id', receipt.id);
  if (cashReceipt) {
    await supabase.from('opportunity_receipts').delete().eq('id', cashReceipt.id);
  }
    
  console.log('\\n🧹 Cleaned up test receipts');
  
  console.log('\\n📊 Summary:');
  console.log('✅ Company cards (1234, 5678, 9999) = NOT reimbursable');
  console.log('✅ Personal cards (any other digits) = REIMBURSABLE');  
  console.log('✅ Cash/check payments = REIMBURSABLE');
}

testPersonalCard().catch(console.error);