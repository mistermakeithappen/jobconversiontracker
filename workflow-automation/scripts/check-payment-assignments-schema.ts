const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the workflow-automation directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSchema() {
  try {
    console.log('Checking user_payment_assignments table schema...\n');

    // Try to fetch one record to see the structure
    const { data, error } = await supabase
      .from('user_payment_assignments')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Sample record:', data);
      if (data && data.length > 0) {
        console.log('\nAvailable columns:');
        Object.keys(data[0]).forEach(col => {
          console.log(`  - ${col}: ${typeof data[0][col]}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();