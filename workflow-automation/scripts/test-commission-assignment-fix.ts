import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCommissionAssignmentFix() {
  console.log('=== Testing Commission Assignment Fix ===\n');

  // Replace with your organization ID
  const organizationId = 'your-org-id'; // You'll need to replace this

  try {
    // 1. Check current payment structures and their types
    console.log('1. Checking all payment structures in organization...');
    const { data: paymentStructures, error: psError } = await supabase
      .from('user_payment_structures')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (psError) {
      console.error('Error fetching payment structures:', psError);
      return;
    }

    console.log(`Found ${paymentStructures?.length || 0} active payment structures:`);
    paymentStructures?.forEach(ps => {
      console.log(`- User: ${ps.ghl_user_name || ps.user_id}`);
      console.log(`  Type: ${ps.payment_type}`);
      console.log(`  Commission %: ${ps.commission_percentage || 'N/A'}`);
      
      const isCommissionEligible = ps.commission_percentage && 
        ps.payment_type && 
        ['commission_gross', 'commission_profit', 'hybrid'].includes(ps.payment_type);
      
      console.log(`  Should get commission: ${isCommissionEligible ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    // 2. Check opportunities with assigned users but no commission assignments
    console.log('2. Checking opportunities without commission assignments...');
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, title, assigned_to, monetary_value')
      .eq('organization_id', organizationId)
      .not('assigned_to', 'is', null)
      .limit(10);

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
      return;
    }

    for (const opp of opportunities || []) {
      // Check if commission assignment exists
      const { data: commissionAssignment } = await supabase
        .from('commission_assignments')
        .select('id, ghl_user_id, commission_type, base_rate')
        .eq('opportunity_id', opp.opportunity_id)
        .eq('organization_id', organizationId)
        .eq('assignment_type', 'opportunity')
        .single();

      // Check payment structure for assigned user
      const paymentStructure = paymentStructures?.find(ps => ps.user_id === opp.assigned_to);
      
      const shouldHaveCommission = paymentStructure && 
        paymentStructure.commission_percentage && 
        paymentStructure.payment_type && 
        ['commission_gross', 'commission_profit', 'hybrid'].includes(paymentStructure.payment_type);

      console.log(`Opportunity: ${opp.title}`);
      console.log(`  Assigned to: ${opp.assigned_to}`);
      console.log(`  Has commission assignment: ${commissionAssignment ? '✅' : '❌'}`);
      console.log(`  Should have commission: ${shouldHaveCommission ? '✅' : '❌'}`);
      
      if (shouldHaveCommission && !commissionAssignment) {
        console.log(`  ⚠️  MISSING COMMISSION ASSIGNMENT!`);
      } else if (!shouldHaveCommission && commissionAssignment) {
        console.log(`  ⚠️  INCORRECT COMMISSION ASSIGNMENT!`);
      } else if (shouldHaveCommission && commissionAssignment) {
        console.log(`  ✅ Correctly assigned`);
      } else {
        console.log(`  ✅ Correctly not assigned`);
      }
      console.log('');
    }

    // 3. Summary
    console.log('3. Summary of fixes:');
    console.log('✅ Added payment_type validation to commission assignment logic');
    console.log('✅ Only users with commission_gross, commission_profit, or hybrid payment types get commissions');
    console.log('✅ Commission type now matches user payment structure type');
    console.log('✅ Added detailed logging for debugging');
    console.log('');
    console.log('To trigger the fix, sync opportunities from GHL or wait for automatic sync.');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCommissionAssignmentFix();
