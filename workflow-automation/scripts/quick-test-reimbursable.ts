import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickTest() {
  console.log('🧪 Quick reimbursable detection test...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get a real integration ID
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id')
    .eq('user_id', mockUserId)
    .limit(1);
    
  const integrationId = integrations?.[0]?.id;
  if (!integrationId) {
    console.log('❌ No integration found, creating a test one...');
    const { data: newIntegration } = await supabase
      .from('integrations')
      .insert({
        user_id: mockUserId,
        integration_type: 'gohighlevel',
        status: 'connected'
      })
      .select('id')
      .single();
    
    if (!newIntegration) {
      console.log('❌ Failed to create integration');
      return;
    }
    console.log('✅ Created test integration:', newIntegration.id);
  }
  
  const testIntegrationId = integrationId || integrations?.[0]?.id;
  
  // Test with a simple receipt
  console.log('🧪 Testing company card (••••1234) - should NOT be reimbursable');
  
  const { data: receipt, error } = await supabase
    .from('opportunity_receipts')
    .insert({
      user_id: mockUserId,
      opportunity_id: 'test-opp-123',
      integration_id: testIntegrationId,
      vendor_name: 'Home Depot Test',
      amount: 100.00,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '1234', // Company card
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
  console.log('   Expected: false (company card)');
  console.log('   Result:', receipt.reimbursable === false ? '✅ CORRECT' : '❌ INCORRECT');
  
  // Clean up
  await supabase
    .from('opportunity_receipts')
    .delete()
    .eq('id', receipt.id);
    
  console.log('🧹 Cleaned up test receipt');
}

quickTest().catch(console.error);