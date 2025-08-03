import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCommissionAssignments() {
  try {
    console.log('Checking Commission Assignments...\n');

    // 1. Check commission_assignments table
    console.log('1. Commission assignments:');
    const { data: assignments, error: assignmentsError } = await supabase
      .from('commission_assignments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return;
    }

    console.log(`Found ${assignments?.length || 0} commission assignments`);
    
    if (assignments && assignments.length > 0) {
      assignments.forEach(assignment => {
        console.log(`\n- Opportunity ID: ${assignment.opportunity_id}`);
        console.log(`  GHL User ID: ${assignment.ghl_user_id}`);
        console.log(`  User Name: ${assignment.user_name}`);
        console.log(`  Commission Type: ${assignment.commission_type}`);
        console.log(`  Base Rate: ${assignment.base_rate}%`);
        console.log(`  Active: ${assignment.is_active}`);
        console.log(`  Disabled: ${assignment.is_disabled}`);
        console.log(`  Created: ${new Date(assignment.created_at).toLocaleString()}`);
      });
    }

    // 2. Check opportunities with assigned users
    console.log('\n\n2. Opportunities with assigned users:');
    const { data: opportunities } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, title, assigned_to')
      .not('assigned_to', 'is', null)
      .limit(10);

    console.log(`Found ${opportunities?.length || 0} opportunities with assigned users`);
    
    if (opportunities && opportunities.length > 0) {
      for (const opp of opportunities) {
        console.log(`\n- ${opp.title} (${opp.opportunity_id})`);
        console.log(`  Assigned to: ${opp.assigned_to}`);
        
        // Check if this opportunity has a commission assignment
        const { data: commission } = await supabase
          .from('commission_assignments')
          .select('*')
          .eq('opportunity_id', opp.opportunity_id)
          .single();
        
        if (commission) {
          console.log(`  ✅ Has commission assignment`);
        } else {
          console.log(`  ❌ No commission assignment`);
        }
      }
    }

    // 3. Check user payment structures
    console.log('\n\n3. Active user payment assignments:');
    const { data: paymentAssignments } = await supabase
      .from('user_payment_assignments')
      .select(`
        ghl_user_id,
        payment_structure_id,
        is_active,
        payment_structures:user_payment_structures!inner(
          ghl_user_name,
          commission_percentage
        )
      `)
      .eq('is_active', true)
      .limit(10);

    console.log(`Found ${paymentAssignments?.length || 0} active payment assignments`);
    
    paymentAssignments?.forEach(assignment => {
      console.log(`\n- GHL User ID: ${assignment.ghl_user_id}`);
      console.log(`  Name: ${assignment.payment_structures.ghl_user_name}`);
      console.log(`  Commission: ${assignment.payment_structures.commission_percentage}%`);
    });

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkCommissionAssignments();