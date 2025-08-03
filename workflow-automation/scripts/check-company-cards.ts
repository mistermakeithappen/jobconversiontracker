import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCompanyCards() {
  console.log('📋 Checking current company credit cards...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get all cards (active and inactive)
  const { data: allCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .order('created_at', { ascending: false });
    
  console.log('📋 All Company Cards:');
  allCards?.forEach(card => {
    console.log(`  ${card.card_name}:`);
    console.log(`    Last 4: ••••${card.last_four_digits}`);
    console.log(`    Reimbursable: ${card.is_reimbursable}`);
    console.log(`    Active: ${card.is_active}`);
    console.log(`    Created: ${new Date(card.created_at).toLocaleString()}`);
    console.log('  ---');
  });
  
  // Get active cards only
  const { data: activeCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('\\n✅ Active Company Cards (what the system uses):');
  activeCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.card_name} - ${card.is_reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
  });
  
  // Check recent receipts
  const { data: recentReceipts } = await supabase
    .from('opportunity_receipts')
    .select('id, vendor_name, amount, last_four_digits, reimbursable, created_at')
    .eq('user_id', mockUserId)
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\\n🧾 Recent Receipts:');
  recentReceipts?.forEach(receipt => {
    console.log(`  ${receipt.vendor_name} ($${receipt.amount}):`);
    console.log(`    Card: ••••${receipt.last_four_digits || 'N/A'}`);
    console.log(`    Status: ${receipt.reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
    console.log(`    Created: ${new Date(receipt.created_at).toLocaleString()}`);
    console.log('  ---');
  });
  
  console.log('\\n💡 Expected Logic:');
  console.log('  - Company cards (in active list above) = NOT REIMBURSABLE');
  console.log('  - Personal cards (any other digits) = REIMBURSABLE');
  console.log('  - Cash/check payments = REIMBURSABLE');
}

checkCompanyCards().catch(console.error);