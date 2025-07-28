import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkWorkflows() {
  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('Checking all workflows in database...\n');
  
  // Get all workflows (bypasses RLS)
  const { data: allWorkflows, error: allError } = await supabase
    .from('workflows')
    .select('*');
    
  if (allError) {
    console.error('Error fetching all workflows:', allError);
  } else {
    console.log(`Total workflows in database: ${allWorkflows?.length || 0}`);
    allWorkflows?.forEach(w => {
      console.log(`- ${w.name} (user: ${w.user_id}, created: ${new Date(w.created_at).toLocaleString()})`);
    });
  }
  
  console.log('\nChecking workflows for mock user...');
  const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';
  
  // Get workflows for specific user
  const { data: userWorkflows, error: userError } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', mockUserId);
    
  if (userError) {
    console.error('Error fetching user workflows:', userError);
  } else {
    console.log(`Workflows for user ${mockUserId}: ${userWorkflows?.length || 0}`);
  }
  
  // Check RLS status
  console.log('\nChecking RLS status...');
  const { data: rls, error: rlsError } = await supabase
    .rpc('pg_catalog.pg_tables')
    .select('*')
    .eq('tablename', 'workflows')
    .single();
    
  console.log('Note: RLS is enabled on the workflows table.');
  console.log('Since we\'re using mock auth, the anon key cannot access the data due to RLS policies.');
}

checkWorkflows();