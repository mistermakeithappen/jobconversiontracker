const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the workflow-automation directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createPaymentAssignments() {
  try {
    console.log('Creating payment assignments for existing structures...\n');

    // Get all payment structures
    const { data: structures, error: structError } = await supabase
      .from('user_payment_structures')
      .select('*');

    if (structError) {
      console.error('Error fetching payment structures:', structError);
      return;
    }

    console.log(`Found ${structures?.length || 0} payment structures`);

    // Get the active organization
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('organization_id')
      .eq('type', 'gohighlevel')
      .eq('is_active', true)
      .single();

    if (intError || !integrations) {
      console.error('Error fetching organization:', intError);
      return;
    }

    const organizationId = integrations.organization_id;
    console.log(`Using organization ID: ${organizationId}\n`);

    // Create payment assignments for each structure
    for (const structure of structures || []) {
      console.log(`\nProcessing payment structure for: ${structure.ghl_user_name}`);
      
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('user_payment_assignments')
        .select('id')
        .eq('payment_structure_id', structure.id)
        .eq('organization_id', organizationId)
        .single();

      if (existing) {
        console.log('  Assignment already exists, skipping...');
        continue;
      }

      // Create the assignment
      const { data: assignment, error: assignError } = await supabase
        .from('user_payment_assignments')
        .insert({
          organization_id: organizationId,
          payment_structure_id: structure.id,
          ghl_user_id: structure.user_id,  // Using user_id as ghl_user_id
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (assignError) {
        console.error('  Error creating assignment:', assignError);
      } else {
        console.log('  ✓ Created payment assignment');
        console.log(`    GHL User ID: ${assignment.ghl_user_id}`);
        console.log(`    Structure ID: ${assignment.payment_structure_id}`);
      }
    }

    // Verify the assignments
    const { data: finalAssignments } = await supabase
      .from('user_payment_assignments')
      .select('*')
      .eq('is_active', true);

    console.log(`\n\nTotal active payment assignments: ${finalAssignments?.length || 0}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

createPaymentAssignments();