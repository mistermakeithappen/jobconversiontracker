import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkParkerCommission() {
  try {
    console.log('Checking Parker\'s Commission Assignment...\n');

    const opportunityId = '8Z3XP0NEenbLDafIHJif'; // Jennifer Antonietti opportunity
    const parkerGhlId = 'FDC2RHj84RoMwGvB0B9n';

    // 1. Check the commission assignment directly
    console.log('1. Commission assignment for this opportunity:');
    const { data: assignment, error } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('ghl_user_id', parkerGhlId)
      .single();

    if (error) {
      console.error('Error fetching assignment:', error);
    } else if (assignment) {
      console.log('Found assignment:');
      console.log(`- ID: ${assignment.id}`);
      console.log(`- Opportunity ID: ${assignment.opportunity_id}`);
      console.log(`- GHL User ID: ${assignment.ghl_user_id}`);
      console.log(`- User Name: ${assignment.user_name}`);
      console.log(`- Commission Type: ${assignment.commission_type}`);
      console.log(`- Base Rate: ${assignment.base_rate}%`);
      console.log(`- Is Active: ${assignment.is_active}`);
      console.log(`- Is Disabled: ${assignment.is_disabled}`);
      console.log(`- Organization ID: ${assignment.organization_id}`);
      console.log(`- Assignment Type: ${assignment.assignment_type}`);
    } else {
      console.log('No assignment found');
    }

    // 2. Check what the API would return
    console.log('\n\n2. What the API query would return:');
    const { data: apiAssignments } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('assignment_type', 'opportunity')
      .eq('is_active', true);

    console.log(`API would return ${apiAssignments?.length || 0} assignments`);
    
    if (apiAssignments && apiAssignments.length > 0) {
      apiAssignments.forEach((a, i) => {
        console.log(`\nAssignment ${i + 1}:`);
        console.log(`- User: ${a.user_name} (${a.ghl_user_id})`);
        console.log(`- Active: ${a.is_active}`);
        console.log(`- Type: ${a.assignment_type}`);
      });
    }

    // 3. Check organization
    console.log('\n\n3. Organization check:');
    const { data: org } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', '2c760c74-f4ba-482c-a942-2198166b98e8')
      .single();
    
    console.log(`User's organization: ${org?.organization_id}`);
    
    if (assignment) {
      console.log(`Assignment organization: ${assignment.organization_id}`);
      console.log(`Organizations match: ${org?.organization_id === assignment.organization_id}`);
    }

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkParkerCommission();