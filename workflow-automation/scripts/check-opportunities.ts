import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkOpportunities() {
  // Check opportunity cache structure
  const { data, error } = await supabase
    .from('opportunity_cache')
    .select('*')
    .limit(2);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample opportunities:', JSON.stringify(data, null, 2));
  
  // Check unique pipeline stages
  const { data: stages } = await supabase
    .from('opportunity_cache')
    .select('pipeline_stage_name')
    .order('pipeline_stage_name');
    
  const uniqueStages = [...new Set(stages?.map(s => s.pipeline_stage_name))];
  console.log('\nUnique pipeline stages:', uniqueStages);
}

checkOpportunities();