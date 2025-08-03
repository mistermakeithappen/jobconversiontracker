import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCardDelete() {
  console.log('🧪 Testing credit card delete functionality...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // First, get all active cards
  const { data: activeCards } = await supabase
    .from('company_credit_cards')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('📋 Active Cards:');
  activeCards?.forEach(card => {
    console.log(`  ID: ${card.id}`);
    console.log(`  Name: ${card.card_name}`);
    console.log(`  Last 4: ••••${card.last_four_digits}`);
    console.log(`  Active: ${card.is_active}`);
    console.log('  ---');
  });
  
  if (activeCards && activeCards.length > 0) {
    const cardToDelete = activeCards[0];
    console.log(`🗑️  Attempting to soft-delete: ${cardToDelete.card_name} (••••${cardToDelete.last_four_digits})`);
    
    // Soft delete the card
    const { data: deletedCard, error } = await supabase
      .from('company_credit_cards')
      .update({ is_active: false })
      .eq('id', cardToDelete.id)
      .eq('user_id', mockUserId)
      .select()
      .single();
    
    if (error) {
      console.log('❌ Delete failed:', error.message);
    } else {
      console.log('✅ Card soft-deleted successfully!');
      console.log(`   is_active changed from true to ${deletedCard.is_active}`);
    }
    
    // Check active cards again
    const { data: afterDeleteCards } = await supabase
      .from('company_credit_cards')
      .select('*')
      .eq('user_id', mockUserId)
      .eq('is_active', true);
    
    console.log(`\\n📊 Active cards after delete: ${afterDeleteCards?.length || 0}`);
    
    // Check all cards (including inactive)
    const { data: allCards } = await supabase
      .from('company_credit_cards')
      .select('*')
      .eq('user_id', mockUserId);
    
    console.log(`📊 Total cards (including inactive): ${allCards?.length || 0}`);
    
    // Restore the card for testing
    await supabase
      .from('company_credit_cards')
      .update({ is_active: true })
      .eq('id', cardToDelete.id);
      
    console.log('🔄 Card restored for continued testing');
  } else {
    console.log('❌ No active cards found to test delete functionality');
  }
}

testCardDelete().catch(console.error);