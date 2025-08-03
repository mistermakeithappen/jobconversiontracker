import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSpecificOpportunity() {
  try {
    console.log('Testing Specific Opportunity Commission Data...\n');

    // Based on the screenshot, the opportunity name contains "Cecile Ogg"
    const searchName = 'Cecile Ogg';
    
    // 1. Find the opportunity in the cache
    console.log(`1. Searching for opportunity containing "${searchName}"...`);
    
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('*')
      .ilike('title', `%${searchName}%`);

    if (oppError) {
      console.error('Error searching opportunities:', oppError);
      return;
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('No opportunities found with that name in the cache.');
      
      // Let's search all opportunities
      console.log('\nSearching ALL opportunities in cache...');
      const { data: allOpps } = await supabase
        .from('opportunity_cache')
        .select('opportunity_id, title, assigned_to, assigned_to_name, organization_id')
        .limit(20);
      
      console.log('\nAll opportunities in cache:');
      allOpps?.forEach(opp => {
        console.log(`- ${opp.title} (${opp.opportunity_id})`);
        console.log(`  Assigned to: ${opp.assigned_to_name || opp.assigned_to || 'Not assigned'}`);
      });
      return;
    }

    console.log(`\nFound ${opportunities.length} opportunity(ies):`);
    
    for (const opp of opportunities) {
      console.log(`\n--- Opportunity: ${opp.title} ---`);
      console.log(`ID: ${opp.opportunity_id}`);
      console.log(`Organization: ${opp.organization_id}`);
      console.log(`Assigned To: ${opp.assigned_to || 'Not assigned'}`);
      console.log(`Assigned To Name: ${opp.assigned_to_name || 'No name'}`);
      console.log(`Monetary Value: $${opp.monetary_value}`);
      console.log(`Status: ${opp.status}`);
      
      // 2. Check commission_assignments for this opportunity
      console.log('\n2. Checking commission_assignments table...');
      
      const { data: assignments, error: assignError } = await supabase
        .from('commission_assignments')
        .select('*')
        .eq('opportunity_id', opp.opportunity_id)
        .eq('organization_id', opp.organization_id);
      
      if (assignError) {
        console.error('Error fetching assignments:', assignError);
        continue;
      }
      
      if (assignments && assignments.length > 0) {
        console.log(`\nFound ${assignments.length} commission assignment(s):`);
        assignments.forEach(assign => {
          console.log(`\n  Assignment ID: ${assign.id}`);
          console.log(`  User: ${assign.user_name || assign.ghl_user_id}`);
          console.log(`  Type: ${assign.commission_type} @ ${assign.base_rate}%`);
          console.log(`  Active: ${assign.is_active}, Disabled: ${assign.is_disabled}`);
          console.log(`  Created: ${new Date(assign.created_at).toLocaleString()}`);
          console.log(`  Notes: ${assign.notes}`);
        });
      } else {
        console.log('❌ NO commission assignments found for this opportunity!');
      }
      
      // 3. If no assignments but has assigned user, check if user has payment structure
      if ((!assignments || assignments.length === 0) && opp.assigned_to) {
        console.log('\n3. Checking if assigned user has payment structure...');
        
        const { data: paymentAssignment } = await supabase
          .from('user_payment_assignments')
          .select(`
            ghl_user_id,
            is_active,
            payment_structures:user_payment_structures!inner(
              ghl_user_name,
              commission_percentage
            )
          `)
          .eq('organization_id', opp.organization_id)
          .eq('ghl_user_id', opp.assigned_to)
          .eq('is_active', true)
          .single();
        
        if (paymentAssignment) {
          console.log('\n✅ User HAS active payment structure:');
          console.log(`  Name: ${paymentAssignment.payment_structures.ghl_user_name}`);
          console.log(`  Commission: ${paymentAssignment.payment_structures.commission_percentage}%`);
          console.log('\n⚠️  Commission should have been auto-created but wasn\'t!');
        } else {
          console.log('\n❌ User does NOT have active payment structure');
          console.log('  This is why no commission was auto-created');
        }
      }
      
      // 4. Test the API endpoint directly
      console.log('\n4. Testing API endpoint response...');
      console.log(`Fetching from: /api/opportunity-commissions?opportunityId=${opp.opportunity_id}`);
      
      // Note: We can't actually call the API from here, but we can show what query it would run
      const apiQuery = supabase
        .from('commission_assignments')
        .select(`
          *,
          team_member:team_members(*)
        `)
        .eq('organization_id', opp.organization_id)
        .eq('opportunity_id', opp.opportunity_id)
        .eq('assignment_type', 'opportunity')
        .eq('is_active', true);
      
      console.log('\nThe API would run this query:', apiQuery);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testSpecificOpportunity();