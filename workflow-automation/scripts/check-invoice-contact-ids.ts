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

async function checkInvoiceContactIds() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get invoices with contact IDs
  const { data: invoices, error } = await supabase
    .from('commission_events')
    .select('*')
    .eq('event_source', 'invoice')
    .not('contact_id', 'is', null)
    .limit(5);
    
  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }
  
  console.log(`Found ${invoices?.length || 0} invoices with contact IDs`);
  
  if (invoices && invoices.length > 0) {
    invoices.forEach(invoice => {
      console.log('\nInvoice:', invoice.event_data?.invoice_number || invoice.invoice_id);
      console.log('  Contact ID:', invoice.contact_id);
      console.log('  Event Data Contact Details:', invoice.event_data?.raw_invoice?.contactDetails);
    });
  }
  
  // Check if contacts table has any data at all
  const { count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });
    
  console.log('\nTotal contacts in contacts table:', count);
  
  // Check the contact sync status
  const { data: syncLogs } = await supabase
    .from('contact_sync_logs')
    .select('*')
    .order('sync_started_at', { ascending: false })
    .limit(1);
    
  if (syncLogs && syncLogs.length > 0) {
    console.log('\nLast contact sync:', syncLogs[0]);
  } else {
    console.log('\nNo contact sync logs found');
  }
}

checkInvoiceContactIds().catch(console.error);