import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugCommissionAssignments() {
  console.log('=== Debugging Commission Assignments ===\n');

  // 1. Check if Parker has a payment structure
  console.log('1. Checking Parker\'s payment structure...');
  const { data: paymentStructures, error: psError } = await supabase
    .from('user_payment_structures')
    .select('*')
    .or('ghl_user_name.ilike.%parker%,ghl_user_email.ilike.%parker%');
  
  if (psError) {
    console.error('Error fetching payment structures:', psError);
  } else {
    console.log('Parker\'s payment structures:', JSON.stringify(paymentStructures, null, 2));
  }

  // 2. Check payment assignments for Parker
  console.log('\n2. Checking Parker\'s payment assignments...');
  const { data: paymentAssignments, error: paError } = await supabase
    .from('user_payment_assignments')
    .select(`
      *,
      payment_structures:user_payment_structures!inner(*)
    `)
    .or('payment_structures.ghl_user_name.ilike.%parker%,payment_structures.ghl_user_email.ilike.%parker%');
  
  if (paError) {
    console.error('Error fetching payment assignments:', paError);
  } else {
    console.log('Parker\'s payment assignments:', JSON.stringify(paymentAssignments, null, 2));
  }

  // 3. Check team members for Parker
  console.log('\n3. Checking team members for Parker...');
  const { data: teamMembers, error: tmError } = await supabase
    .from('team_members')
    .select('*')
    .or('name.ilike.%parker%,email.ilike.%parker%');
  
  if (tmError) {
    console.error('Error fetching team members:', tmError);
  } else {
    console.log('Parker in team_members:', JSON.stringify(teamMembers, null, 2));
  }

  // 4. Check opportunities assigned to Parker
  console.log('\n4. Checking opportunities assigned to Parker...');
  let parkerGhlUserId = null;
  
  if (teamMembers && teamMembers.length > 0) {
    parkerGhlUserId = teamMembers[0].ghl_user_id;
    
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunity_cache')
      .select('opportunity_id, title, assigned_to, monetary_value')
      .eq('assigned_to', parkerGhlUserId)
      .limit(5);
    
    if (oppError) {
      console.error('Error fetching opportunities:', oppError);
    } else {
      console.log(`Opportunities assigned to Parker (${parkerGhlUserId}):`, JSON.stringify(opportunities, null, 2));
      
      // 5. Check commission assignments for these opportunities
      if (opportunities && opportunities.length > 0) {
        console.log('\n5. Checking commission assignments for Parker\'s opportunities...');
        for (const opp of opportunities) {
          const { data: commissions, error: commError } = await supabase
            .from('commission_assignments')
            .select('*')
            .eq('opportunity_id', opp.opportunity_id);
          
          if (commError) {
            console.error(`Error fetching commissions for opportunity ${opp.opportunity_id}:`, commError);
          } else {
            console.log(`\nOpportunity: ${opp.title} (${opp.opportunity_id})`);
            console.log(`Commission assignments:`, JSON.stringify(commissions, null, 2));
          }
        }
      }
    }
  }

  // 6. Check for any commission assignments with Parker's name
  console.log('\n6. Checking all commission assignments with Parker\'s name...');
  const { data: allCommissions, error: acError } = await supabase
    .from('commission_assignments')
    .select('*')
    .or('user_name.ilike.%parker%,ghl_user_id.ilike.%parker%')
    .limit(10);
  
  if (acError) {
    console.error('Error fetching all commissions:', acError);
  } else {
    console.log('All commission assignments for Parker:', JSON.stringify(allCommissions, null, 2));
  }

  // 7. Check Cecile Ogg opportunity specifically
  console.log('\n7. Checking Cecile Ogg opportunity specifically...');
  const { data: cecileOpp, error: coError } = await supabase
    .from('opportunity_cache')
    .select('*')
    .or('title.ilike.%cecile%,contact_name.ilike.%cecile%')
    .limit(1);
  
  if (coError) {
    console.error('Error fetching Cecile opportunity:', coError);
  } else if (cecileOpp && cecileOpp.length > 0) {
    console.log('Cecile Ogg opportunity:', JSON.stringify(cecileOpp[0], null, 2));
    
    // Check commissions for this opportunity
    const { data: cecileComm, error: ccError } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('opportunity_id', cecileOpp[0].opportunity_id);
    
    if (ccError) {
      console.error('Error fetching Cecile commissions:', ccError);
    } else {
      console.log('Commission assignments for Cecile Ogg opportunity:', JSON.stringify(cecileComm, null, 2));
    }
  }
}

debugCommissionAssignments().catch(console.error);