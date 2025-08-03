import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCommissionAssignments() {
  try {
    console.log('Testing Commission Assignments...\n');

    // Get the first organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
      .single();

    if (orgError || !org) {
      console.error('No organization found:', orgError);
      return;
    }

    console.log('Organization:', org.name, org.id);

    // 1. Check opportunity_cache for assigned users
    console.log('\n1. Checking opportunity_cache for assigned users...');
    
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, name, assigned_to, assigned_to_name')
      .eq('organization_id', org.id)
      .not('assigned_to', 'is', null)
      .limit(10);

    if (opportunities && opportunities.length > 0) {
      console.log(`\nFound ${opportunities.length} opportunities with assigned users:`);
      opportunities.forEach(opp => {
        console.log(`- ${opp.name}: assigned_to=${opp.assigned_to}, name=${opp.assigned_to_name || 'NO NAME'}`);
      });
    } else {
      console.log('No opportunities with assigned users found in cache');
    }

    // 2. Check commission_assignments table
    console.log('\n\n2. Checking commission_assignments table...');
    
    const { data: assignments, error: assignError } = await supabase
      .from('commission_assignments')
      .select(`
        id,
        opportunity_id,
        ghl_user_id,
        user_name,
        commission_type,
        base_rate,
        is_active,
        is_disabled,
        created_at,
        notes
      `)
      .eq('organization_id', org.id)
      .eq('assignment_type', 'opportunity')
      .order('created_at', { ascending: false })
      .limit(20);

    if (assignments && assignments.length > 0) {
      console.log(`\nFound ${assignments.length} commission assignments:`);
      assignments.forEach(assign => {
        console.log(`\n- Opportunity: ${assign.opportunity_id}`);
        console.log(`  User: ${assign.user_name || assign.ghl_user_id}`);
        console.log(`  Type: ${assign.commission_type} @ ${assign.base_rate}%`);
        console.log(`  Active: ${assign.is_active}, Disabled: ${assign.is_disabled}`);
        console.log(`  Notes: ${assign.notes}`);
        console.log(`  Created: ${new Date(assign.created_at).toLocaleString()}`);
      });
    } else {
      console.log('No commission assignments found');
    }

    // 3. Check user_payment_assignments for active structures
    console.log('\n\n3. Checking user_payment_assignments...');
    
    const { data: paymentAssignments, error: payError } = await supabase
      .from('user_payment_assignments')
      .select(`
        ghl_user_id,
        is_active,
        payment_structures:user_payment_structures!inner(
          ghl_user_name,
          commission_percentage
        )
      `)
      .eq('organization_id', org.id)
      .eq('is_active', true);

    if (paymentAssignments && paymentAssignments.length > 0) {
      console.log(`\nFound ${paymentAssignments.length} active payment structures:`);
      paymentAssignments.forEach(pa => {
        console.log(`- User: ${pa.payment_structures.ghl_user_name} (${pa.ghl_user_id})`);
        console.log(`  Commission: ${pa.payment_structures.commission_percentage}%`);
      });
    } else {
      console.log('No active payment structures found');
    }

    // 4. Cross-check: opportunities with assigned users but no commission assignments
    console.log('\n\n4. Cross-checking for missing commission assignments...');
    
    if (opportunities && opportunities.length > 0) {
      const opportunityIds = opportunities.map(o => o.opportunity_id);
      
      const { data: existingAssignments } = await supabase
        .from('commission_assignments')
        .select('opportunity_id')
        .eq('organization_id', org.id)
        .in('opportunity_id', opportunityIds);

      const assignedOppIds = new Set(existingAssignments?.map(a => a.opportunity_id) || []);
      
      const missingAssignments = opportunities.filter(o => !assignedOppIds.has(o.opportunity_id));
      
      if (missingAssignments.length > 0) {
        console.log(`\n⚠️  Found ${missingAssignments.length} opportunities with assigned users but NO commission assignments:`);
        missingAssignments.forEach(opp => {
          console.log(`- ${opp.name} (${opp.opportunity_id})`);
          console.log(`  Assigned to: ${opp.assigned_to_name || opp.assigned_to}`);
        });
      } else {
        console.log('\n✅ All opportunities with assigned users have commission assignments');
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCommissionAssignments();