import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOpportunityAssignedUser() {
  console.log('Checking opportunity_cache table for assigned user data...\n');
  
  try {
    // Get a sample of opportunities
    const { data: opportunities, error } = await supabase
      .from('opportunity_cache')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error fetching opportunities:', error);
      return;
    }
    
    console.log(`Found ${opportunities?.length || 0} opportunities:\n`);
    
    opportunities?.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title || opp.opportunity_id}`);
      console.log(`   Contact: ${opp.contact_name || 'N/A'}`);
      console.log(`   Assigned To ID: ${opp.assigned_to || 'NOT SET'}`);
      console.log(`   Assigned To Name: ${opp.assigned_to_name || 'NOT SET'}`);
      console.log('');
    });
    
    // Count how many have assigned users
    const assignedCount = opportunities?.filter(o => o.assigned_to || o.assigned_to_name).length || 0;
    console.log(`\nSummary: ${assignedCount} out of ${opportunities?.length || 0} opportunities have assigned users`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOpportunityAssignedUser();