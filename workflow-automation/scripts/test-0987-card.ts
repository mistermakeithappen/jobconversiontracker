import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test0987Card() {
  console.log('🧪 Testing card ••••0987 (should be REIMBURSABLE)...\n');
  
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
  
  // Test via API route (simulating the frontend form)
  console.log('📝 Creating receipt via API (simulating form submission)...');
  
  const receiptData = {
    opportunityId: 'test-0987-opportunity',
    integrationId: integrationId,
    vendor_name: 'Test Store',
    amount: 25.99,
    category: 'Materials',
    receipt_date: new Date().toISOString().split('T')[0],
    submitted_by: 'Test User',
    payment_method: 'credit_card',
    last_four_digits: '0987'
  };
  
  try {
    const response = await fetch('http://localhost:3001/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Receipt created via API!');
      console.log(`   Vendor: ${result.receipt.vendor_name}`);
      console.log(`   Amount: $${result.receipt.amount}`);
      console.log(`   Card: ••••${result.receipt.last_four_digits}`);
      console.log(`   Reimbursable: ${result.receipt.reimbursable ? 'TRUE (REIMBURSABLE)' : 'FALSE (COMPANY CARD)'}`);
      console.log(`   Expected: TRUE (should be reimbursable since 0987 is not a company card)`);
      console.log(`   Result: ${result.receipt.reimbursable === true ? '✅ CORRECT' : '❌ INCORRECT'}`);
      
      // Clean up
      await supabase
        .from('opportunity_receipts')
        .delete()
        .eq('id', result.receipt.id);
        
      console.log('🧹 Test receipt cleaned up');
    } else {
      console.log('❌ API Error:', result.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    console.log('💡 Make sure the dev server is running on port 3001');
  }
}

test0987Card().catch(console.error);