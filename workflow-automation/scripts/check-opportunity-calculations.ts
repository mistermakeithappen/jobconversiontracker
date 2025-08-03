import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOpportunityCalculations() {
  try {
    console.log('Checking opportunity commission calculations...\n');

    // Get a few opportunities from the ones shown in the screenshot
    const opportunityIds = [
      'BRIz8H2zAeFAfmDUNtVr', // Unknown Opportunity
      'dZLRQJN8X0rBGZJRvCiU', // Jennifer Antonietti
      'XNnQHQcqJl1pR8EJbVfN', // Birgitta Hendon
      '1SRAAGfkSK22Ue79u9Gi', // Cecile Ogg
      'Ulrg0cRtA5ZD93bHXdT2', // JANET HOLMBERG
      '7FLs7Z3tKJCnMYe8LdOr'  // Matt Raven
    ];

    for (const oppId of opportunityIds) {
      console.log(`\nChecking opportunity: ${oppId}`);
      
      // Get commission assignments
      const { data: assignments } = await supabase
        .from('commission_assignments')
        .select('*')
        .eq('opportunity_id', oppId)
        .eq('is_active', true);

      if (assignments && assignments.length > 0) {
        console.log(`  Has ${assignments.length} commission assignment(s):`);
        assignments.forEach(a => {
          console.log(`  - ${a.user_name}: ${a.base_rate}% of ${a.commission_type}`);
        });
      } else {
        console.log(`  ❌ NO commission assignments`);
      }
    }

    // Also check the opportunities API endpoint to see what it's calculating
    console.log('\n\nChecking what the API calculates for opportunities...');
    
  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkOpportunityCalculations();