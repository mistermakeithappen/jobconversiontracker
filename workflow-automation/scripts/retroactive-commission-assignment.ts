import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function retroactiveCommissionAssignment() {
  try {
    console.log('Creating Retroactive Commission Assignments...\n');

    const organizationId = '79c6e6cf-7d7d-434e-9930-6a1d69654cd2';
    const userId = '2c760c74-f4ba-482c-a942-2198166b98e8'; // Current user for created_by

    // 1. Get all opportunities with assigned users
    const { data: opportunities } = await supabase
      .from('opportunity_cache')
      .select('*')
      .eq('organization_id', organizationId)
      .not('assigned_to', 'is', null);

    console.log(`Found ${opportunities?.length || 0} opportunities with assigned users\n`);

    // 2. Get all active payment assignments
    const { data: paymentAssignments } = await supabase
      .from('user_payment_assignments')
      .select(`
        ghl_user_id,
        payment_structure_id,
        payment_structures:user_payment_structures!inner(
          user_id,
          ghl_user_name,
          ghl_user_email,
          commission_percentage
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    // Create a map for quick lookup
    const paymentMap = new Map();
    paymentAssignments?.forEach(pa => {
      paymentMap.set(pa.ghl_user_id, pa);
    });

    console.log(`Found ${paymentMap.size} users with payment structures\n`);

    let created = 0;
    let skipped = 0;
    let noPaymentStructure = 0;

    for (const opp of opportunities || []) {
      // Check if commission assignment already exists
      const { data: existing } = await supabase
        .from('commission_assignments')
        .select('id')
        .eq('opportunity_id', opp.opportunity_id)
        .eq('organization_id', organizationId)
        .eq('assignment_type', 'opportunity');

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Check if user has payment structure
      const paymentAssignment = paymentMap.get(opp.assigned_to);
      
      if (!paymentAssignment) {
        noPaymentStructure++;
        console.log(`⚠️  No payment structure for ${opp.assigned_to} - ${opp.title}`);
        continue;
      }

      // Create commission assignment
      const structure = paymentAssignment.payment_structures;
      
      const { data: newAssignment, error } = await supabase
        .from('commission_assignments')
        .insert({
          organization_id: organizationId,
          assignment_type: 'opportunity',
          opportunity_id: opp.opportunity_id,
          ghl_user_id: opp.assigned_to,
          user_name: structure.ghl_user_name || 'Unknown User',
          user_email: structure.ghl_user_email,
          commission_type: 'percentage_profit', // Default to profit-based
          base_rate: structure.commission_percentage, // Use actual percentage from payment structure
          is_active: true,
          notes: 'Retroactively assigned based on opportunity assignment',
          created_by: userId
        })
        .select();

      if (error) {
        console.error(`❌ Error creating assignment for ${opp.title}:`, error.message);
      } else {
        created++;
        console.log(`✅ Created commission for ${opp.title} → ${structure.ghl_user_name}`);
      }
    }

    console.log('\n\nSummary:');
    console.log(`✅ Created: ${created} new commission assignments`);
    console.log(`⏭️  Skipped: ${skipped} (already had assignments)`);
    console.log(`⚠️  No payment structure: ${noPaymentStructure} opportunities`);

  } catch (error) {
    console.error('Retroactive assignment failed:', error);
  }
}

// Run the retroactive assignment
retroactiveCommissionAssignment();