import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkDuplicateCommissions() {
  console.log('Checking for duplicate commission assignments...\n');

  try {
    // Get all commission assignments
    const { data: assignments, error } = await supabase
      .from('commission_assignments')
      .select('*')
      .eq('assignment_type', 'opportunity')
      .order('opportunity_id', { ascending: true })
      .order('ghl_user_id', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching assignments:', error);
      return;
    }

    console.log(`Total opportunity commission assignments: ${assignments.length}\n`);

    // Group by opportunity_id and ghl_user_id to find duplicates
    const grouped = assignments.reduce((acc: any, assignment: any) => {
      const key = `${assignment.opportunity_id}-${assignment.ghl_user_id}`;
      if (\!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(assignment);
      return acc;
    }, {});

    // Find duplicates
    const duplicates = Object.entries(grouped).filter(([_, assignments]: [string, any]) => assignments.length > 1);

    if (duplicates.length === 0) {
      console.log('No duplicate commission assignments found\!');
      return;
    }

    console.log(`Found ${duplicates.length} sets of duplicate assignments:\n`);

    duplicates.forEach(([key, assignments]: [string, any]) => {
      console.log(`\nOpportunity-User: ${key}`);
      console.log('Assignments:');
      assignments.forEach((a: any) => {
        console.log(`  - ID: ${a.id}`);
        console.log(`    User: ${a.user_name} (${a.ghl_user_id})`);
        console.log(`    Rate: ${a.base_rate}%`);
        console.log(`    Type: ${a.commission_type}`);
        console.log(`    Active: ${a.is_active}`);
        console.log(`    Disabled: ${a.is_disabled}`);
        console.log(`    Created: ${a.created_at}`);
      });
    });

    // Suggest cleanup
    console.log('\n\nSuggested cleanup:');
    duplicates.forEach(([key, assignments]: [string, any]) => {
      // Keep the most recent active one, deactivate others
      const sorted = assignments.sort((a: any, b: any) => {
        // Prefer active over inactive
        if (a.is_active \!== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        // Prefer not disabled over disabled
        if (a.is_disabled \!== b.is_disabled) {
          return a.is_disabled ? 1 : -1;
        }
        // Then by creation date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const toKeep = sorted[0];
      const toDeactivate = sorted.slice(1);

      console.log(`\nFor ${key}:`);
      console.log(`  Keep: ${toKeep.id} (${toKeep.user_name}, ${toKeep.base_rate}%, active: ${toKeep.is_active}, disabled: ${toKeep.is_disabled})`);
      toDeactivate.forEach((a: any) => {
        console.log(`  Deactivate: ${a.id} (${a.user_name}, ${a.base_rate}%, active: ${a.is_active}, disabled: ${a.is_disabled})`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDuplicateCommissions();
EOF < /dev/null