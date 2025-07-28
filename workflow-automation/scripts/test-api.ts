import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'Present' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Test fetching workflows
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', 'af8ba507-b380-4da8-a1e2-23adee7497d5')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
    } else {
      console.log('Successfully fetched workflows:', data?.length || 0, 'workflows');
    }

    // Test creating a workflow
    const testWorkflow = {
      user_id: 'af8ba507-b380-4da8-a1e2-23adee7497d5',
      name: 'Test Workflow',
      description: 'Test from API',
      definition: {
        nodes: [{
          id: '1',
          type: 'input',
          data: { label: 'Start' },
          position: { x: 100, y: 100 }
        }],
        edges: []
      },
      is_active: false
    };

    const { data: newWorkflow, error: createError } = await supabase
      .from('workflows')
      .insert(testWorkflow)
      .select()
      .single();

    if (createError) {
      console.error('Error creating workflow:', createError);
    } else {
      console.log('Successfully created workflow:', newWorkflow.id);
      
      // Clean up test workflow
      const { error: deleteError } = await supabase
        .from('workflows')
        .delete()
        .eq('id', newWorkflow.id);
        
      if (!deleteError) {
        console.log('Test workflow cleaned up');
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();