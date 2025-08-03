import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMissingCommissions() {
  try {
    console.log('Checking for Missing Commission Assignments...\n');

    const organizationId = '79c6e6cf-7d7d-434e-9930-6a1d69654cd2';

    // 1. Get all opportunities with assigned users
    console.log('1. Opportunities with assigned users:');
    const { data: opportunities } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, title, assigned_to')
      .eq('organization_id', organizationId)
      .not('assigned_to', 'is', null)
      .order('title');

    console.log(`Found ${opportunities?.length || 0} opportunities with assigned users\n`);

    // 2. Check which ones have commission assignments
    const missingCommissions = [];
    const hasCommissions = [];

    for (const opp of opportunities || []) {
      const { data: commission } = await supabase
        .from('commission_assignments')
        .select('id, ghl_user_id, user_name')
        .eq('opportunity_id', opp.opportunity_id)
        .eq('organization_id', organizationId)
        .single();

      if (commission) {
        hasCommissions.push({ ...opp, commission });
      } else {
        missingCommissions.push(opp);
      }
    }

    console.log(`✅ ${hasCommissions.length} opportunities HAVE commission assignments:`);
    hasCommissions.forEach(item => {
      console.log(`   - ${item.title} → ${item.commission.user_name}`);
    });

    console.log(`\n❌ ${missingCommissions.length} opportunities MISSING commission assignments:`);
    missingCommissions.forEach(opp => {
      console.log(`   - ${opp.title} (assigned to: ${opp.assigned_to})`);
    });

    // 3. Check which assigned users have payment structures
    console.log('\n\n2. Payment structures for assigned users:');
    const uniqueAssignedUsers = [...new Set(opportunities?.map(o => o.assigned_to) || [])];
    
    for (const userId of uniqueAssignedUsers) {
      const { data: assignment } = await supabase
        .from('user_payment_assignments')
        .select(`
          ghl_user_id,
          payment_structures:user_payment_structures!inner(
            ghl_user_name,
            commission_percentage
          )
        `)
        .eq('organization_id', organizationId)
        .eq('ghl_user_id', userId)
        .eq('is_active', true)
        .single();

      if (assignment) {
        console.log(`✅ ${userId} → ${assignment.payment_structures.ghl_user_name} (${assignment.payment_structures.commission_percentage}%)`);
      } else {
        console.log(`❌ ${userId} → NO PAYMENT STRUCTURE`);
      }
    }

    // 4. Show what needs to be done
    console.log('\n\n3. Action needed:');
    console.log('- Run "Sync Data" again to create commission assignments for opportunities with payment structures');
    console.log('- Create payment structures for users without them in Settings > Payment Structure');

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkMissingCommissions();