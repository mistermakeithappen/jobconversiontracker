import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugUserMismatch() {
  try {
    console.log('Debugging User ID Mismatch...\n');

    // 1. Get all unique assigned user IDs from opportunities
    console.log('1. Unique assigned user IDs from opportunities:');
    const { data: opportunities } = await supabase
      .from('opportunity_cache')
      .select('assigned_to')
      .not('assigned_to', 'is', null);

    const uniqueAssignedUsers = [...new Set(opportunities?.map(o => o.assigned_to) || [])];
    console.log(`Found ${uniqueAssignedUsers.length} unique assigned users:`);
    uniqueAssignedUsers.forEach(id => console.log(`- ${id}`));

    // 2. Get all GHL user IDs from payment assignments
    console.log('\n\n2. GHL user IDs from payment assignments:');
    const { data: paymentAssignments } = await supabase
      .from('user_payment_assignments')
      .select('ghl_user_id, payment_structures:user_payment_structures!inner(ghl_user_name)')
      .eq('is_active', true);

    console.log(`Found ${paymentAssignments?.length || 0} payment assignments:`);
    paymentAssignments?.forEach(pa => {
      console.log(`- ${pa.ghl_user_id} (${pa.payment_structures.ghl_user_name})`);
    });

    // 3. Get all team members with GHL user IDs
    console.log('\n\n3. Team members with GHL user IDs:');
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('ghl_user_id, name')
      .not('ghl_user_id', 'is', null);

    console.log(`Found ${teamMembers?.length || 0} team members:`);
    teamMembers?.forEach(tm => {
      console.log(`- ${tm.ghl_user_id} (${tm.name})`);
    });

    // 4. Check which assigned users don't have payment structures
    console.log('\n\n4. Assigned users WITHOUT payment structures:');
    const paymentUserIds = new Set(paymentAssignments?.map(pa => pa.ghl_user_id) || []);
    const missingUsers = uniqueAssignedUsers.filter(id => !paymentUserIds.has(id));
    
    console.log(`${missingUsers.length} users are assigned to opportunities but have no payment structure:`);
    for (const userId of missingUsers) {
      // Check if this user exists in team_members
      const teamMember = teamMembers?.find(tm => tm.ghl_user_id === userId);
      console.log(`- ${userId} ${teamMember ? `(${teamMember.name})` : '(No name found)'}`);
    }

    // 5. Get organization info
    console.log('\n\n5. Organization info:');
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .single();
    
    console.log(`Organization: ${org?.name} (${org?.id})`);

  } catch (error) {
    console.error('Debug failed:', error);
  }
}

// Run the debug
debugUserMismatch();