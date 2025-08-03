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

async function verifyInvoiceContactMapping() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get some invoices to check their contact IDs
  const { data: invoices, error: invoicesError } = await supabase
    .from('commission_events')
    .select('*')
    .eq('event_source', 'invoice')
    .not('contact_id', 'is', null)
    .limit(5);
    
  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError);
    return;
  }
  
  console.log(`Checking ${invoices?.length || 0} invoices...`);
  
  if (invoices && invoices.length > 0) {
    // Get unique contact IDs from invoices
    const contactIds = [...new Set(invoices.map(inv => inv.contact_id))];
    console.log('\nUnique contact IDs from invoices:', contactIds);
    
    // Try to find these contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('ghl_contact_id, first_name, last_name, email, full_name')
      .in('ghl_contact_id', contactIds);
      
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
    } else {
      console.log(`\nFound ${contacts?.length || 0} matching contacts in database`);
      
      // Create a map for easy lookup
      const contactsMap = new Map();
      contacts?.forEach(contact => {
        contactsMap.set(contact.ghl_contact_id, contact);
      });
      
      // Check each invoice
      console.log('\nInvoice to Contact Mapping:');
      invoices.forEach(invoice => {
        const contact = contactsMap.get(invoice.contact_id);
        const contactIdFromData = invoice.event_data?.raw_invoice?.contactDetails?.id;
        
        console.log(`\nInvoice ${invoice.event_data?.invoice_number}:`);
        console.log(`  Stored contact_id: ${invoice.contact_id}`);
        console.log(`  Contact ID from raw data: ${contactIdFromData}`);
        console.log(`  Contact found: ${contact ? 'YES' : 'NO'}`);
        if (contact) {
          const name = contact.first_name || contact.last_name ? 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 
            contact.full_name;
          console.log(`  Contact name: ${name}`);
          console.log(`  Contact email: ${contact.email || 'N/A'}`);
        }
        console.log(`  Raw contact name from invoice: ${invoice.event_data?.raw_invoice?.contactDetails?.name}`);
      });
    }
  }
}

verifyInvoiceContactMapping().catch(console.error);