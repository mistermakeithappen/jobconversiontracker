import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupDefaultCommissions() {
  try {
    console.log('Cleaning up incorrect 10% default commission assignments...\n');

    // 1. Find all commission assignments with 10% rate
    const { data: assignments, error } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('base_rate', 10)
      .eq('assignment_type', 'opportunity');

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    console.log(`Found ${assignments?.length || 0} commission assignments with 10% rate\n`);

    let deleted = 0;
    let kept = 0;

    for (const assignment of assignments || []) {
      // Check if this 10% is actually from the user's payment structure
      const { data: paymentAssignment } = await supabase
        .from('user_payment_assignments')
        .select(`
          payment_structures:user_payment_structures!inner(
            commission_percentage
          )
        `)
        .eq('ghl_user_id', assignment.ghl_user_id)
        .eq('organization_id', assignment.organization_id)
        .eq('is_active', true)
        .single();
      
      const actualPercentage = paymentAssignment?.payment_structures?.commission_percentage;
      
      if (actualPercentage === 10) {
        // This is a legitimate 10% from the payment structure
        kept++;
        console.log(`✅ Keeping legitimate 10% for ${assignment.user_name} (${assignment.opportunity_id})`);
      } else {
        // This is a default 10% that should be removed
        console.log(`❌ Removing default 10% for ${assignment.user_name} (${assignment.opportunity_id})`);
        
        const { error: deleteError } = await supabase
          .from('commission_assignments')
          .delete()
          .eq('id', assignment.id);
        
        if (deleteError) {
          console.error(`   Error deleting assignment ${assignment.id}:`, deleteError);
        } else {
          deleted++;
        }
      }
    }

    // 2. Also find any assignments where the user has no payment structure
    console.log('\n\nChecking for assignments without payment structures...');
    
    const { data: allAssignments } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('assignment_type', 'opportunity');

    let noStructureDeleted = 0;

    for (const assignment of allAssignments || []) {
      // Check if user has a payment structure
      const { data: paymentAssignment } = await supabase
        .from('user_payment_assignments')
        .select(`
          payment_structures:user_payment_structures!inner(
            commission_percentage
          )
        `)
        .eq('ghl_user_id', assignment.ghl_user_id)
        .eq('is_active', true)
        .single();

      if (!paymentAssignment || !paymentAssignment.payment_structures?.commission_percentage) {
        console.log(`❌ Removing assignment for ${assignment.user_name} - no payment structure`);
        
        const { error: deleteError } = await supabase
          .from('commission_assignments')
          .delete()
          .eq('id', assignment.id);
        
        if (deleteError) {
          console.error(`   Error deleting assignment ${assignment.id}:`, deleteError);
        } else {
          noStructureDeleted++;
        }
      }
    }

    console.log('\n\nSummary:');
    console.log(`✅ Kept: ${kept} legitimate 10% commissions`);
    console.log(`❌ Deleted: ${deleted} default 10% commissions`);
    console.log(`❌ Deleted: ${noStructureDeleted} commissions with no payment structure`);
    console.log(`Total removed: ${deleted + noStructureDeleted}`);

  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupDefaultCommissions();