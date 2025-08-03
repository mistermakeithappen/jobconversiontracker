import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOpportunityDirect() {
  try {
    console.log('Checking Opportunity Data Directly...\n');

    const opportunityId = 'ChBDIIHhkN0DtybrPWye';

    // 1. Check opportunity_cache across all organizations
    console.log(`1. Checking opportunity_cache for ${opportunityId}...`);
    
    const { data: cachedOpp } = await supabase
      .from('opportunity_cache')
      .select('*')
      .eq('opportunity_id', opportunityId);

    if (cachedOpp && cachedOpp.length > 0) {
      const opp = cachedOpp[0];
      console.log('\nOpportunity found in cache:');
      console.log(`- Title: ${opp.title}`);
      console.log(`- Organization: ${opp.organization_id}`);
      console.log(`- Status: ${opp.status}`);
      console.log(`- Monetary Value: $${opp.monetary_value}`);
      console.log(`- Assigned To (ID): ${opp.assigned_to || 'NOT ASSIGNED'}`);
      console.log(`- Assigned To (Name): ${opp.assigned_to_name || 'NO NAME'}`);
      console.log(`- Pipeline Stage: ${opp.pipeline_stage_name}`);
      console.log(`- Last Synced: ${opp.synced_at}`);

      // 2. Check commission_assignments for this opportunity
      console.log(`\n2. Checking commission_assignments...`);
      
      const { data: assignments } = await supabase
        .from('commission_assignments')
        .select('*')
        .eq('opportunity_id', opportunityId);

      if (assignments && assignments.length > 0) {
        console.log(`\nFound ${assignments.length} commission assignment(s):`);
        assignments.forEach(assign => {
          console.log(`\n- Assignment ID: ${assign.id}`);
          console.log(`  Organization: ${assign.organization_id}`);
          console.log(`  GHL User ID: ${assign.ghl_user_id}`);
          console.log(`  User Name: ${assign.user_name}`);
          console.log(`  Type: ${assign.commission_type} @ ${assign.base_rate}%`);
          console.log(`  Active: ${assign.is_active}, Disabled: ${assign.is_disabled}`);
          console.log(`  Created: ${new Date(assign.created_at).toLocaleString()}`);
        });

        // Check if this matches the organization from the API call
        console.log('\n3. Checking organization match...');
        
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', [opp.organization_id, ...assignments.map(a => a.organization_id)]);

        console.log('\nOrganizations involved:');
        orgs?.forEach(org => {
          console.log(`- ${org.name} (${org.id})`);
        });

      } else {
        console.log('❌ NO commission assignments found!');
        
        // Check if assigned user has payment structure
        if (opp.assigned_to) {
          console.log('\n3. Checking payment structure for assigned user...');
          
          const { data: paymentAssignments } = await supabase
            .from('user_payment_assignments')
            .select(`
              *,
              payment_structures:user_payment_structures!inner(*)
            `)
            .eq('ghl_user_id', opp.assigned_to)
            .eq('is_active', true);

          if (paymentAssignments && paymentAssignments.length > 0) {
            console.log(`\nFound ${paymentAssignments.length} payment assignment(s) for user ${opp.assigned_to}:`);
            paymentAssignments.forEach(pa => {
              console.log(`\n- Organization: ${pa.organization_id}`);
              console.log(`  User Name: ${pa.payment_structures.ghl_user_name}`);
              console.log(`  Commission: ${pa.payment_structures.commission_percentage}%`);
              console.log(`  Payment Type: ${pa.payment_structures.payment_type}`);
            });
          } else {
            console.log(`\n❌ No active payment assignments found for user ${opp.assigned_to}`);
          }
        }
      }
      
    } else {
      console.log('❌ Opportunity NOT found in cache!');
      
      // Check if any opportunities exist
      const { count } = await supabase
        .from('opportunity_cache')
        .select('*', { count: 'exact', head: true });
      
      console.log(`\nTotal opportunities in cache: ${count || 0}`);
    }

    // 4. Check integrations
    console.log('\n4. Checking GHL integrations...');
    
    const { data: integrations } = await supabase
      .from('integrations')
      .select('organization_id, is_active, config')
      .eq('type', 'gohighlevel')
      .eq('is_active', true);

    console.log(`\nFound ${integrations?.length || 0} active GHL integrations`);
    integrations?.forEach(int => {
      console.log(`- Org: ${int.organization_id}, Location: ${int.config?.locationId}`);
    });

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkOpportunityDirect();