const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the workflow-automation directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkOpportunityData() {
  try {
    console.log('Checking opportunity data in cache...\n');

    // Check all opportunities in cache
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
      return;
    }

    console.log(`Found ${opportunities?.length || 0} opportunities in cache:\n`);
    
    opportunities?.forEach(opp => {
      console.log(`Opportunity: ${opp.name}`);
      console.log(`  ID: ${opp.opportunity_id}`);
      console.log(`  Assigned To ID: ${opp.assigned_to}`);
      console.log(`  Assigned To Name: ${opp.assigned_to_name}`);
      console.log(`  Pipeline: ${opp.pipeline_name}`);
      console.log(`  Stage: ${opp.pipeline_stage_name}`);
      console.log(`  Value: $${opp.monetary_value}`);
      console.log(`  Created: ${opp.created_at}`);
      console.log('');
    });

    // Check if any have assigned users
    const { data: assignedOpps, error: assignedError } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, name, assigned_to, assigned_to_name')
      .not('assigned_to', 'is', null);

    if (!assignedError) {
      console.log(`\nOpportunities with assigned users: ${assignedOpps?.length || 0}`);
      
      // Check commission assignments for these
      if (assignedOpps && assignedOpps.length > 0) {
        const oppIds = assignedOpps.map(o => o.opportunity_id);
        
        const { data: commissions } = await supabase
          .from('commission_assignments')
          .select('opportunity_id')
          .in('opportunity_id', oppIds)
          .eq('assignment_type', 'opportunity');
        
        const commissionsMap = new Set(commissions?.map(c => c.opportunity_id));
        const missing = assignedOpps.filter(o => !commissionsMap.has(o.opportunity_id));
        
        console.log(`Commission assignments found: ${commissions?.length || 0}`);
        console.log(`Missing commission assignments: ${missing.length}`);
        
        if (missing.length > 0) {
          console.log('\nOpportunities missing commission assignments:');
          missing.forEach(opp => {
            console.log(`- ${opp.name} (${opp.opportunity_id})`);
            console.log(`  Assigned to: ${opp.assigned_to_name} (${opp.assigned_to})`);
          });
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkOpportunityData();