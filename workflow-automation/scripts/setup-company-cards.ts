import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupCompanyCards() {
  console.log('Setting up company credit cards...');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5'; // Mock user ID
  
  // Company credit cards (expenses on these cards are NOT reimbursable)
  const companyCards = [
    {
      user_id: mockUserId,
      card_name: 'Company Amex Business',
      last_four_digits: '1234',
      card_type: 'amex',
      is_reimbursable: false, // Company card = NOT reimbursable
      notes: 'Main company American Express business card'
    },
    {
      user_id: mockUserId,
      card_name: 'Company Visa Corporate',
      last_four_digits: '5678',
      card_type: 'visa',
      is_reimbursable: false, // Company card = NOT reimbursable
      notes: 'Corporate Visa card for business expenses'
    },
    {
      user_id: mockUserId,
      card_name: 'Fleet Fuel Card',
      last_four_digits: '9999',
      card_type: 'other',
      is_reimbursable: false, // Company card = NOT reimbursable
      notes: 'Fleet card for fuel and vehicle expenses'
    }
  ];
  
  // Clear existing cards first
  const { error: deleteError } = await supabase
    .from('company_credit_cards')
    .delete()
    .eq('user_id', mockUserId);
    
  if (deleteError) {
    console.error('Error clearing existing cards:', deleteError);
  }
  
  // Insert company cards
  const { data: cards, error: insertError } = await supabase
    .from('company_credit_cards')
    .insert(companyCards)
    .select();
    
  if (insertError) {
    console.error('Error inserting company cards:', insertError);
    return;
  }
  
  console.log('✅ Company credit cards setup complete:');
  cards?.forEach(card => {
    console.log(`  - ${card.card_name} (••••${card.last_four_digits}) - ${card.is_reimbursable ? 'REIMBURSABLE' : 'COMPANY CARD'}`);
  });
  
  console.log('\\n📋 Testing Logic:');
  console.log('  - Receipts with last 4 digits 1234, 5678, or 9999 = Company Card (NOT reimbursable)');
  console.log('  - Receipts with any other last 4 digits = Personal Card (REIMBURSABLE)');
  console.log('  - Receipts with cash/check payment = REIMBURSABLE');
}

// Run the setup
setupCompanyCards().catch(console.error);