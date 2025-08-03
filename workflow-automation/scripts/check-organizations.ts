import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOrganizations() {
  try {
    console.log('Checking Organizations and Data...\n');

    // 1. Get all organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      return;
    }

    console.log(`Found ${orgs?.length || 0} organizations:`);
    orgs?.forEach(org => {
      console.log(`\n- ${org.name}`);
      console.log(`  ID: ${org.id}`);
      console.log(`  Created: ${new Date(org.created_at).toLocaleString()}`);
    });

    // 2. Check integrations
    console.log('\n\n--- GoHighLevel Integrations ---');
    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, organization_id, type, is_active, config')
      .eq('type', 'gohighlevel');

    integrations?.forEach(int => {
      console.log(`\nOrg ID: ${int.organization_id}`);
      console.log(`Integration Active: ${int.is_active}`);
      console.log(`Location ID: ${int.config?.locationId}`);
    });

    // 3. Check opportunity_cache by organization
    console.log('\n\n--- Opportunity Cache by Organization ---');
    for (const org of orgs || []) {
      const { data: opps, count } = await supabase
        .from('opportunity_cache')
        .select('opportunity_id', { count: 'exact', head: false })
        .eq('organization_id', org.id)
        .limit(1);

      const { data: withAssigned, count: assignedCount } = await supabase
        .from('opportunity_cache')
        .select('opportunity_id', { count: 'exact', head: false })
        .eq('organization_id', org.id)
        .not('assigned_to', 'is', null)
        .limit(1);

      console.log(`\n${org.name}:`);
      console.log(`  Total opportunities: ${count || 0}`);
      console.log(`  With assigned users: ${assignedCount || 0}`);
    }

    // 4. Check commission_assignments by organization
    console.log('\n\n--- Commission Assignments by Organization ---');
    for (const org of orgs || []) {
      const { data: assignments, count } = await supabase
        .from('commission_assignments')
        .select('id', { count: 'exact', head: false })
        .eq('organization_id', org.id)
        .eq('assignment_type', 'opportunity')
        .limit(1);

      console.log(`\n${org.name}:`);
      console.log(`  Commission assignments: ${count || 0}`);
    }

    // 5. Check user_payment_assignments
    console.log('\n\n--- Payment Structures by Organization ---');
    for (const org of orgs || []) {
      const { data: payments, count } = await supabase
        .from('user_payment_assignments')
        .select('ghl_user_id', { count: 'exact', head: false })
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .limit(1);

      console.log(`\n${org.name}:`);
      console.log(`  Active payment assignments: ${count || 0}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
checkOrganizations();