import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testReimbursableDetection() {
  console.log('🧪 Testing automatic reimbursable detection...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  const opportunityId = 'test-opportunity-123';
  const integrationId = 'af8ba507-b380-4da8-a1e2-23adee7497d5'; // Use same UUID format
  
  // Test cases
  const testReceipts = [
    {
      description: 'Company Card Test (should be NOT reimbursable)',
      vendor_name: 'Home Depot',
      amount: 125.50,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '1234', // Company card
      expected_reimbursable: false
    },
    {
      description: 'Personal Card Test (should be reimbursable)',
      vendor_name: 'Lowes',
      amount: 89.99,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'credit_card',
      last_four_digits: '4567', // Personal card (not in company cards)
      expected_reimbursable: true
    },
    {
      description: 'Cash Payment Test (should be reimbursable)',
      vendor_name: 'Hardware Store',
      amount: 45.00,
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      submitted_by: 'Test User',
      payment_method: 'cash',
      last_four_digits: null,
      expected_reimbursable: true
    }
  ];
  
  // Clean up any existing test receipts
  await supabase
    .from('opportunity_receipts')
    .delete()
    .eq('user_id', mockUserId)
    .eq('opportunity_id', opportunityId);
  
  console.log('📋 Test Results:');
  console.log('================');
  
  for (const testReceipt of testReceipts) {
    console.log(`\\n🧪 ${testReceipt.description}`);
    console.log(`   Vendor: ${testReceipt.vendor_name}`);
    console.log(`   Payment: ${testReceipt.payment_method}${testReceipt.last_four_digits ? ` (••••${testReceipt.last_four_digits})` : ''}`);
    console.log(`   Expected: ${testReceipt.expected_reimbursable ? 'REIMBURSABLE' : 'COMPANY CARD'}`);
    
    const { data: receipt, error } = await supabase
      .from('opportunity_receipts')
      .insert({
        user_id: mockUserId,
        opportunity_id: opportunityId,
        integration_id: integrationId,
        vendor_name: testReceipt.vendor_name,
        amount: testReceipt.amount,
        category: testReceipt.category,
        receipt_date: testReceipt.receipt_date,
        submitted_by: testReceipt.submitted_by,
        payment_method: testReceipt.payment_method,
        last_four_digits: testReceipt.last_four_digits,
        submitter_user_id: mockUserId
      })
      .select()
      .single();
    
    if (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      continue;
    }
    
    const actualReimbursable = receipt.reimbursable;
    const isCorrect = actualReimbursable === testReceipt.expected_reimbursable;
    
    console.log(`   Actual: ${actualReimbursable ? 'REIMBURSABLE' : 'COMPANY CARD'}`);
    console.log(`   Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    
    if (!isCorrect) {
      console.log(`   ⚠️  Expected ${testReceipt.expected_reimbursable} but got ${actualReimbursable}`);
    }
  }
  
  console.log('\\n📊 Summary:');
  console.log('============');
  console.log('Company Cards (NOT reimbursable): ••••1234, ••••5678, ••••9999');
  console.log('Personal Cards (REIMBURSABLE): Any other last 4 digits');
  console.log('Cash/Check (REIMBURSABLE): No card number needed');
  
  // Clean up test data
  await supabase
    .from('opportunity_receipts')
    .delete()
    .eq('user_id', mockUserId)
    .eq('opportunity_id', opportunityId);
    
  console.log('\\n🧹 Test data cleaned up.');
}

// Run the test
testReimbursableDetection().catch(console.error);