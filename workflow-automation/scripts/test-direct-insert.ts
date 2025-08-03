import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testDirectInsert() {
  console.log('🧪 Testing direct database insert to check trigger behavior...\n');
  
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
  
  console.log('🧪 Test 1: Direct insert with personal card (••••4567) and explicit reimbursable=true');
  
  const { data: receipt1, error: error1 } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-direct-1',
      integration_id: integrationId,
      vendor_name: 'Direct Test 1',
      amount: 100.00,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '4567', // Personal card
      reimbursable: true, // Explicitly set to true
      submitter_user_id: mockUserId
    })
    .select()
    .single();
  
  if (error1) {
    console.log('❌ Error:', error1.message);
  } else {
    console.log('✅ Receipt created!');
    console.log('   Explicitly set: true');
    console.log('   Final value:', receipt1.reimbursable);
    console.log('   Trigger override:', receipt1.reimbursable !== true ? 'YES (BAD)' : 'NO (GOOD)');
  }
  
  console.log('\\n🧪 Test 2: Direct insert with company card (••••1234) and explicit reimbursable=false');
  
  const { data: receipt2, error: error2 } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-direct-2',
      integration_id: integrationId,
      vendor_name: 'Direct Test 2',
      amount: 200.00,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '1234', // Company card
      reimbursable: false, // Explicitly set to false
      submitter_user_id: mockUserId
    })
    .select()
    .single();
  
  if (error2) {
    console.log('❌ Error:', error2.message);
  } else {
    console.log('✅ Receipt created!');
    console.log('   Explicitly set: false');
    console.log('   Final value:', receipt2.reimbursable);
    console.log('   Trigger override:', receipt2.reimbursable !== false ? 'YES (UNEXPECTED)' : 'NO (GOOD)');
  }
  
  // Clean up
  if (receipt1) await supabase.from('opportunity_receipts').delete().eq('id', receipt1.id);
  if (receipt2) await supabase.from('opportunity_receipts').delete().eq('id', receipt2.id);
  
  console.log('\\n🧹 Cleaned up test receipts');
  
  console.log('\\n📊 Conclusion:');
  console.log('If trigger overrides explicit values, we need to disable or fix the trigger');
  console.log('If trigger respects explicit values, the issue is in our API logic');
}

testDirectInsert().catch(console.error);