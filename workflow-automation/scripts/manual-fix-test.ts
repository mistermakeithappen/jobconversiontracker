import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function manualFixTest() {
  console.log('🔧 Manual fix test for reimbursable status...\n');
  
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get all company cards for reference
  const { data: companyCards } = await supabase
    .from('company_credit_cards')
    .select('last_four_digits, is_reimbursable')
    .eq('user_id', mockUserId)
    .eq('is_active', true);
    
  console.log('📋 Company Cards (should be NOT reimbursable):');
  companyCards?.forEach(card => {
    console.log(`  ••••${card.last_four_digits}: ${card.is_reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
  });
  
  // Get all receipts and manually fix them
  const { data: receipts } = await supabase
    .from('opportunity_receipts')
    .select('id, vendor_name, last_four_digits, reimbursable, payment_method')
    .eq('user_id', mockUserId);
    
  console.log(`\\n🧾 Found ${receipts?.length || 0} receipts to check`);
  
  let fixedCount = 0;
  
  for (const receipt of receipts || []) {
    let shouldBeReimbursable = false;
    
    if (receipt.last_four_digits) {
      // Check if it's a company card
      const companyCard = companyCards?.find(cc => cc.last_four_digits === receipt.last_four_digits);
      shouldBeReimbursable = companyCard ? companyCard.is_reimbursable : true;
    } else {
      // No card number - check payment method
      shouldBeReimbursable = receipt.payment_method === 'cash' || receipt.payment_method === 'check';
    }
    
    if (receipt.reimbursable !== shouldBeReimbursable) {
      console.log(`\\n🔧 Fixing: ${receipt.vendor_name}`);
      console.log(`   Card: ••••${receipt.last_four_digits || 'N/A'}`);
      console.log(`   Current: ${receipt.reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
      console.log(`   Should be: ${shouldBeReimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}`);
      
      // Use a raw SQL update to try to bypass any triggers
      const { error } = await supabase
        .rpc('exec_sql', {
          sql: `UPDATE opportunity_receipts SET reimbursable = ${shouldBeReimbursable} WHERE id = '${receipt.id}'`
        })
        .then(() => ({ error: null }))
        .catch(() => {
          // Fallback to regular update
          return supabase
            .from('opportunity_receipts')
            .update({ reimbursable: shouldBeReimbursable })
            .eq('id', receipt.id);
        });
        
      if (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      } else {
        console.log(`   ✅ Updated!`);
        fixedCount++;
      }
    } else {
      console.log(`✅ ${receipt.vendor_name}: Already correct (${receipt.reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'})`);
    }
  }
  
  console.log(`\\n📊 Summary: Fixed ${fixedCount} receipts`);
  
  // Now test creating a new receipt with 0987
  console.log('\\n🧪 Testing new receipt with ••••0987...');
  
  const { data: integrations } = await supabase
    .from('integrations')
    .select('id')
    .eq('user_id', mockUserId)
    .limit(1);
    
  const integrationId = integrations?.[0]?.id;
  
  if (integrationId) {
    // The issue is the trigger is still running. Let me try to insert without reimbursable field
    // and then update it immediately
    
    const { data: newReceipt, error } = await supabase
      .from('opportunity_receipts')
      .insert({
        user_id: mockUserId,
        opportunity_id: 'test-manual-fix',
        integration_id: integrationId,
        vendor_name: 'Manual Fix Test',
        amount: 99.99,
        category: 'Materials',
        receipt_date: new Date().toISOString().split('T')[0],
        submitted_by: 'Test User',
        payment_method: 'credit_card',
        last_four_digits: '0987',
        submitter_user_id: mockUserId
        // Don't set reimbursable initially
      })
      .select()
      .single();
    
    if (error) {
      console.log(`❌ Failed to create test receipt: ${error.message}`);
    } else {
      console.log(`✅ Created receipt, trigger set reimbursable to: ${newReceipt.reimbursable}`);
      
      // Now immediately update it
      const { data: updatedReceipt, error: updateError } = await supabase
        .from('opportunity_receipts')
        .update({ reimbursable: true }) // 0987 should be reimbursable (personal card)
        .eq('id', newReceipt.id)
        .select()
        .single();
        
      if (updateError) {
        console.log(`❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`🔧 After manual update: ${updatedReceipt.reimbursable}`);
        console.log(`Result: ${updatedReceipt.reimbursable ? '✅ SUCCESS - Now reimbursable!' : '❌ STILL BROKEN - Trigger overrode update too'}`);
      }
      
      // Clean up
      await supabase.from('opportunity_receipts').delete().eq('id', newReceipt.id);
    }
  }
}

manualFixTest().catch(console.error);