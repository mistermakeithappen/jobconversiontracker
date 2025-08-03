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

async function verifyInvoiceContacts() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get a sample of invoices with contact_ids
  const { data: invoices, error: invoicesError } = await supabase
    .from('commission_events')
    .select('*')
    .eq('event_source', 'invoice')
    .not('contact_id', 'is', null)
    .limit(10);
    
  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError);
    return;
  }
  
  console.log(`Found ${invoices?.length || 0} invoices with contact IDs`);
  
  if (invoices && invoices.length > 0) {
    // Get unique contact IDs
    const contactIds = [...new Set(invoices.map(inv => inv.contact_id))];
    console.log('Unique contact IDs:', contactIds);
    
    // Try to fetch corresponding contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('contact_id, first_name, last_name, email')
      .in('contact_id', contactIds);
      
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
    } else {
      console.log(`Found ${contacts?.length || 0} matching contacts`);
      
      // Map invoices to contacts
      invoices.forEach(invoice => {
        const contact = contacts?.find(c => c.contact_id === invoice.contact_id);
        console.log(`Invoice ${invoice.event_data?.invoice_number || invoice.invoice_id}:`);
        console.log(`  Contact ID: ${invoice.contact_id}`);
        console.log(`  Contact Name: ${contact ? `${contact.first_name} ${contact.last_name}` : 'NOT FOUND'}`);
        console.log('---');
      });
    }
  }
}

verifyInvoiceContacts().catch(console.error);