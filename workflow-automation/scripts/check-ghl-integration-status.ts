const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the workflow-automation directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkGHLIntegration() {
  try {
    console.log('Checking GHL integration status...\n');

    // Check integrations
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'gohighlevel')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching integrations:', intError);
      return;
    }

    console.log(`Found ${integrations?.length || 0} active GHL integrations:\n`);
    
    integrations?.forEach(int => {
      console.log(`Integration: ${int.name}`);
      console.log(`  ID: ${int.id}`);
      console.log(`  Organization ID: ${int.organization_id}`);
      console.log(`  Location ID: ${int.config?.locationId}`);
      console.log(`  Connected: ${int.is_active}`);
      console.log(`  Created: ${int.created_at}`);
      console.log('');
    });

    // Check user payment structures
    const { data: paymentStructures, error: psError } = await supabase
      .from('user_payment_structures')
      .select('*')
      .order('created_at', { ascending: false });

    if (!psError) {
      console.log(`\nUser Payment Structures: ${paymentStructures?.length || 0}`);
      paymentStructures?.forEach(ps => {
        console.log(`\nPayment Structure:`);
        console.log(`  User ID: ${ps.user_id}`);
        console.log(`  GHL User Name: ${ps.ghl_user_name}`);
        console.log(`  GHL User Email: ${ps.ghl_user_email}`);
        console.log(`  Commission %: ${ps.commission_percentage}`);
      });
    }

    // Check payment assignments
    const { data: assignments, error: paError } = await supabase
      .from('user_payment_assignments')
      .select('*')
      .eq('is_active', true);

    if (!paError) {
      console.log(`\n\nActive Payment Assignments: ${assignments?.length || 0}`);
      assignments?.forEach(pa => {
        console.log(`\nPayment Assignment:`);
        console.log(`  GHL User ID: ${pa.ghl_user_id}`);
        console.log(`  Organization ID: ${pa.organization_id}`);
        console.log(`  Structure ID: ${pa.payment_structure_id}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkGHLIntegration();