import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  try {
    console.log('Checking commission_assignments table schema...\n');

    // Try to query with is_disabled column
    const { data, error } = await supabase
      .from('commission_assignments')
      .select('id, is_disabled')
      .limit(1);

    if (error) {
      if (error.message.includes('column "is_disabled" does not exist')) {
        console.log('❌ Column is_disabled does NOT exist in commission_assignments table');
        console.log('\nYou need to add it. Run this SQL in Supabase dashboard:\n');
        console.log(`ALTER TABLE commission_assignments
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;`);
      } else {
        console.error('Error:', error);
      }
    } else {
      console.log('✅ Column is_disabled EXISTS in commission_assignments table');
      if (data && data.length > 0) {
        console.log('Sample value:', data[0].is_disabled);
      }
    }

    // Also check the full schema
    console.log('\n\nChecking full table structure...');
    const { data: sample, error: sampleError } = await supabase
      .from('commission_assignments')
      .select('*')
      .limit(1);

    if (!sampleError && sample && sample.length > 0) {
      console.log('\nAvailable columns:');
      Object.keys(sample[0]).forEach(col => {
        console.log(`- ${col}`);
      });
    }

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkSchema();