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

async function addAssignedUserColumns() {
  console.log('Adding assigned user columns to opportunity_cache table...');
  
  try {
    // Add assigned_to column
    const { error: error1 } = await supabase
      .from('opportunity_cache')
      .select('assigned_to')
      .limit(1);
    
    if (error1?.message?.includes('column "assigned_to" does not exist')) {
      console.log('Adding assigned_to column...');
      // Note: We can't execute raw SQL through Supabase JS client
      console.log(`
Please run this SQL in your Supabase SQL Editor:

-- Add assigned user columns to opportunity_cache table
ALTER TABLE opportunity_cache 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);

-- Create index for assigned_to for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunity_cache_assigned_to 
ON opportunity_cache(assigned_to) 
WHERE assigned_to IS NOT NULL;
      `);
    } else if (!error1) {
      console.log('✅ assigned_to column already exists');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addAssignedUserColumns();