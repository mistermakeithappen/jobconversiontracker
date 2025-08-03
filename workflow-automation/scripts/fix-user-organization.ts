import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixUserOrganization() {
  try {
    console.log('Fixing User Organization Links...\n');

    // Get all organization members
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('*');

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return;
    }

    console.log(`Found ${members?.length || 0} organization members`);

    // Update each user with their organization
    for (const member of members || []) {
      console.log(`\nUpdating user ${member.user_id} with organization ${member.organization_id}`);
      
      const { data, error } = await supabase
        .from('users')
        .update({ organization_id: member.organization_id })
        .eq('id', member.user_id)
        .select();

      if (error) {
        console.error(`Error updating user ${member.user_id}:`, error);
      } else {
        console.log(`✅ Updated user ${member.user_id}`);
      }
    }

    // Verify the fix
    console.log('\n\nVerifying fix...');
    const { data: users } = await supabase
      .from('users')
      .select('id, email, organization_id');

    console.log('\nUpdated users:');
    users?.forEach(user => {
      console.log(`- ${user.email}: org=${user.organization_id || 'STILL NULL'}`);
    });

    console.log('\n✅ Fix complete! Now try refreshing the opportunities page.');

  } catch (error) {
    console.error('Fix failed:', error);
  }
}

// Run the fix
fixUserOrganization();