import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

async function checkContactsStructure() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check contacts table structure
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Contacts table columns:', data.length > 0 ? Object.keys(data[0]) : 'No data');
    if (data.length > 0) {
      console.log('Sample contact:', JSON.stringify(data[0], null, 2));
    }
  }
  
  // Check if there's a specific column for GHL contact ID
  const { data: tableInfo } = await supabase
    .rpc('get_table_columns', { table_name: 'contacts' })
    .limit(10);
    
  console.log('\nTable schema info:', tableInfo);
}

checkContactsStructure().catch(console.error);