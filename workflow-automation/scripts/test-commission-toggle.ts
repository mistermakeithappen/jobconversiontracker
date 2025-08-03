import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCommissionToggle() {
  try {
    console.log('Testing Commission Toggle...\n');

    // 1. Find a commission assignment to test
    const { data: assignments } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('assignment_type', 'opportunity')
      .eq('is_active', true)
      .limit(1);

    if (!assignments || assignments.length === 0) {
      console.log('No commission assignments found to test');
      return;
    }

    const assignment = assignments[0];
    console.log('Testing with assignment:');
    console.log(`- ID: ${assignment.id}`);
    console.log(`- Opportunity: ${assignment.opportunity_id}`);
    console.log(`- User: ${assignment.user_name}`);
    console.log(`- Current is_disabled: ${assignment.is_disabled}`);

    // 2. Toggle is_disabled
    const newDisabledState = !assignment.is_disabled;
    console.log(`\nToggling is_disabled to: ${newDisabledState}`);

    const { data: updated, error } = await supabase
      .from('commission_assignments')
      .update({
        is_disabled: newDisabledState,
        updated_at: new Date().toISOString()
      })
      .eq('id', assignment.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating:', error);
    } else {
      console.log('✅ Successfully updated!');
      console.log(`- New is_disabled: ${updated.is_disabled}`);
    }

    // 3. Verify the update
    const { data: verified } = await supabase
      .from('commission_assignments')
      .select('id, is_disabled')
      .eq('id', assignment.id)
      .single();

    console.log(`\nVerification - is_disabled is now: ${verified?.is_disabled}`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCommissionToggle();