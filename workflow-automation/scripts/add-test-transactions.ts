import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
const integrationId = 'f6c7c1fd-442b-4298-be42-447aa078326d';

async function addTestTransactions() {
  console.log('Adding test transactions...\n');
  
  // Get some products first
  const { data: products } = await supabase
    .from('ghl_products')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('integration_id', integrationId)
    .limit(3);
    
  if (!products || products.length === 0) {
    console.error('No products found. Please sync products first.');
    return;
  }
  
  // Create test transactions
  const testTransactions = [
    {
      user_id: mockUserId,
      integration_id: integrationId,
      opportunity_id: 'opp-test-001',
      contact_id: 'contact-test-001',
      product_id: products[0].id,
      ghl_payment_id: 'pay-test-001',
      amount: 1500.00,
      currency: 'USD',
      payment_date: new Date().toISOString(),
      payment_method: 'credit_card',
      payment_status: 'completed',
      transaction_type: 'sale',
      notes: 'Test transaction 1'
    },
    {
      user_id: mockUserId,
      integration_id: integrationId,
      opportunity_id: 'opp-test-002',
      contact_id: 'contact-test-002',
      product_id: products[1]?.id || products[0].id,
      ghl_payment_id: 'pay-test-002',
      amount: 2500.00,
      currency: 'USD',
      payment_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      payment_method: 'credit_card',
      payment_status: 'completed',
      transaction_type: 'sale',
      notes: 'Test transaction 2'
    },
    {
      user_id: mockUserId,
      integration_id: integrationId,
      opportunity_id: 'opp-test-003',
      contact_id: 'contact-test-003',
      product_id: products[2]?.id || products[0].id,
      ghl_payment_id: 'pay-test-003',
      amount: 3500.00,
      currency: 'USD',
      payment_date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      payment_method: 'ach',
      payment_status: 'completed',
      transaction_type: 'subscription_initial',
      subscription_id: 'sub-test-001',
      is_first_payment: true,
      notes: 'Test subscription'
    },
    {
      user_id: mockUserId,
      integration_id: integrationId,
      opportunity_id: 'opp-test-004',
      contact_id: 'contact-test-004',
      ghl_payment_id: 'pay-test-004',
      amount: 500.00,
      currency: 'USD',
      payment_date: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      payment_method: 'cash',
      payment_status: 'pending',
      transaction_type: 'sale',
      notes: 'Pending payment'
    }
  ];
  
  // Insert test transactions
  const { data, error } = await supabase
    .from('sales_transactions')
    .insert(testTransactions)
    .select();
    
  if (error) {
    console.error('Error inserting transactions:', JSON.stringify(error, null, 2));
  } else {
    console.log(`Successfully added ${data.length} test transactions`);
    console.log('\nTest transactions:');
    data.forEach((t, i) => {
      console.log(`${i + 1}. ${t.ghl_payment_id} - $${t.amount} - ${t.payment_status}`);
    });
  }
}

addTestTransactions().catch(console.error);