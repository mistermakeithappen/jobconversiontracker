import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugCommissionCreation() {
  try {
    console.log('Debugging Commission Creation...\n');

    // Get the specific opportunity ID from the logs
    const opportunityId = 'ChBDIIHhkN0DtybrPWye';
    const userId = '2c760c74-f4ba-482c-a942-2198166b98e8'; // From the logs

    // 1. Find the organization
    const { data: user } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (!user) {
      console.error('User not found in users table for ID:', userId);
      
      // Let's check all users
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, email, organization_id');
      
      console.log('\nAll users in database:');
      allUsers?.forEach(u => {
        console.log(`- ${u.email} (${u.id}) - Org: ${u.organization_id}`);
      });
      return;
    }

    const organizationId = user.organization_id;
    console.log('Organization ID:', organizationId);

    // 2. Check if opportunity exists in cache
    console.log(`\n1. Checking opportunity_cache for ${opportunityId}...`);
    
    const { data: cachedOpp } = await supabase
      .from('opportunity_cache')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', organizationId)
      .single();

    if (cachedOpp) {
      console.log('\nOpportunity found in cache:');
      console.log(`- Title: ${cachedOpp.title}`);
      console.log(`- Status: ${cachedOpp.status}`);
      console.log(`- Monetary Value: $${cachedOpp.monetary_value}`);
      console.log(`- Assigned To (ID): ${cachedOpp.assigned_to || 'NOT ASSIGNED'}`);
      console.log(`- Assigned To (Name): ${cachedOpp.assigned_to_name || 'NO NAME'}`);
      console.log(`- Last Synced: ${cachedOpp.last_synced_at}`);
    } else {
      console.log('❌ Opportunity NOT found in cache!');
    }

    // 3. Check commission_assignments
    console.log(`\n2. Checking commission_assignments for opportunity ${opportunityId}...`);
    
    const { data: assignments } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', organizationId);

    if (assignments && assignments.length > 0) {
      console.log(`\nFound ${assignments.length} commission assignment(s):`);
      assignments.forEach(assign => {
        console.log(`\n- Assignment ID: ${assign.id}`);
        console.log(`  GHL User ID: ${assign.ghl_user_id}`);
        console.log(`  User Name: ${assign.user_name}`);
        console.log(`  Type: ${assign.commission_type} @ ${assign.base_rate}%`);
        console.log(`  Active: ${assign.is_active}, Disabled: ${assign.is_disabled}`);
        console.log(`  Created: ${new Date(assign.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ NO commission assignments found!');
    }

    // 4. If opportunity has assigned user but no commission, check why
    if (cachedOpp?.assigned_to && (!assignments || assignments.length === 0)) {
      console.log('\n3. Opportunity has assigned user but no commission. Checking why...');
      
      // Check if the assigned user has a payment structure
      const { data: paymentAssignment } = await supabase
        .from('user_payment_assignments')
        .select(`
          *,
          payment_structures:user_payment_structures!inner(*)
        `)
        .eq('organization_id', organizationId)
        .eq('ghl_user_id', cachedOpp.assigned_to)
        .eq('is_active', true)
        .single();

      if (paymentAssignment) {
        console.log('\n✅ Assigned user HAS active payment structure:');
        console.log(`- GHL User ID: ${paymentAssignment.ghl_user_id}`);
        console.log(`- Structure ID: ${paymentAssignment.payment_structure_id}`);
        console.log(`- User Name: ${paymentAssignment.payment_structures.ghl_user_name}`);
        console.log(`- Commission: ${paymentAssignment.payment_structures.commission_percentage}%`);
        console.log('\n⚠️  Commission SHOULD have been created but wasn\'t!');
      } else {
        console.log('\n❌ Assigned user does NOT have active payment structure');
        
        // Check if they have any payment structure at all
        const { data: anyStructure } = await supabase
          .from('user_payment_structures')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('user_id', cachedOpp.assigned_to);

        if (anyStructure && anyStructure.length > 0) {
          console.log(`\nUser has ${anyStructure.length} payment structure(s) but none are active/assigned`);
        } else {
          console.log('\nUser has NO payment structures at all');
        }
      }
    }

    // 5. Check all payment structures and assignments
    console.log('\n4. All payment structures and assignments for this organization:');
    
    const { data: allAssignments } = await supabase
      .from('user_payment_assignments')
      .select(`
        *,
        payment_structures:user_payment_structures!inner(*)
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (allAssignments && allAssignments.length > 0) {
      console.log(`\nFound ${allAssignments.length} active payment assignment(s):`);
      allAssignments.forEach(pa => {
        console.log(`\n- GHL User ID: ${pa.ghl_user_id}`);
        console.log(`  Name: ${pa.payment_structures.ghl_user_name}`);
        console.log(`  Commission: ${pa.payment_structures.commission_percentage}%`);
      });
    } else {
      console.log('\n❌ No active payment assignments found');
    }

    // 6. Check integration status
    console.log('\n5. Checking integration status...');
    
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (integration) {
      console.log('\n✅ GHL Integration is active');
      console.log(`- Location ID: ${integration.config?.locationId}`);
      console.log(`- Last sync: ${integration.updated_at}`);
    } else {
      console.log('\n❌ No active GHL integration found');
    }

  } catch (error) {
    console.error('Debug failed:', error);
  }
}

// Run the debug
debugCommissionCreation();