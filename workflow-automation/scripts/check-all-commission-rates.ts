import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllCommissionRates() {
  try {
    console.log('Checking all commission assignments and their rates...\n');

    // Get all commission assignments
    const { data: assignments } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('assignment_type', 'opportunity')
      .order('base_rate', { ascending: false });

    console.log(`Found ${assignments?.length || 0} commission assignments\n`);

    // Group by rate
    const rateGroups = new Map<number, any[]>();
    
    assignments?.forEach(assignment => {
      const rate = assignment.base_rate || 0;
      if (!rateGroups.has(rate)) {
        rateGroups.set(rate, []);
      }
      rateGroups.get(rate)!.push(assignment);
    });

    // Display grouped results
    console.log('Commission rates breakdown:');
    for (const [rate, items] of rateGroups) {
      console.log(`\n${rate}% rate: ${items.length} assignments`);
      items.forEach(item => {
        console.log(`  - ${item.user_name} → ${item.opportunity_id}`);
      });
    }

    // Check for null commission percentages in payment structures
    console.log('\n\nChecking payment structures with null commission percentages:');
    const { data: nullCommissions } = await supabase
      .from('user_payment_structures')
      .select('*')
      .is('commission_percentage', null);

    console.log(`\nFound ${nullCommissions?.length || 0} payment structures with null commission percentage`);
    nullCommissions?.forEach(ps => {
      console.log(`- ${ps.ghl_user_name} (${ps.ghl_user_email})`);
    });

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkAllCommissionRates();