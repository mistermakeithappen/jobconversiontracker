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

async function checkContactsColumns() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get a sample contact to see its structure
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching contacts:', error);
    return;
  }
  
  if (contacts && contacts.length > 0) {
    console.log('Contact table columns:', Object.keys(contacts[0]));
    console.log('\nSample contact:', JSON.stringify(contacts[0], null, 2));
    
    // Check which column contains the GHL contact ID
    const contact = contacts[0];
    console.log('\nLooking for GHL contact ID column...');
    Object.entries(contact).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 10 && value.match(/^[a-zA-Z0-9]+$/)) {
        console.log(`  ${key}: ${value}`);
      }
    });
  }
  
  // Also check total count
  const { count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });
    
  console.log('\nTotal contacts:', count);
}

checkContactsColumns().catch(console.error);