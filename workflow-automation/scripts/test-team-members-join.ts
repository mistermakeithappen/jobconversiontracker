import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testTeamMembersJoin() {
  try {
    console.log('Testing Team Members Join...\n');

    const opportunityId = '8Z3XP0NEenbLDafIHJif';
    const organizationId = '79c6e6cf-7d7d-434e-9930-6a1d69654cd2';

    // 1. Test the query that's failing
    console.log('1. Testing the exact query from the API:');
    const { data: assignments, error: assignmentsError } = await supabase
      .from('commission_assignments')
      .select(`
        *,
        team_member:team_members(*)
      `)
      .eq('organization_id', organizationId)
      .eq('opportunity_id', opportunityId)
      .eq('assignment_type', 'opportunity')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (assignmentsError) {
      console.error('❌ Query failed:', assignmentsError);
      console.error('Error details:', JSON.stringify(assignmentsError, null, 2));
    } else {
      console.log('✅ Query succeeded!');
      console.log(`Found ${assignments?.length || 0} assignments`);
    }

    // 2. Test without the join
    console.log('\n\n2. Testing without the team_members join:');
    const { data: simpleAssignments, error: simpleError } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('opportunity_id', opportunityId)
      .eq('assignment_type', 'opportunity')
      .eq('is_active', true);

    if (simpleError) {
      console.error('❌ Simple query failed:', simpleError);
    } else {
      console.log('✅ Simple query succeeded!');
      console.log(`Found ${simpleAssignments?.length || 0} assignments`);
    }

    // 3. Check if team_members table exists
    console.log('\n\n3. Checking team_members table:');
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);

    if (tmError) {
      console.error('❌ Team members table error:', tmError);
    } else {
      console.log('✅ Team members table exists');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testTeamMembersJoin();