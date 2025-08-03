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

async function fixInvoiceContactIds() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get all invoices that have the wrong contact_id (location ID)
  const { data: invoices, error: invoicesError } = await supabase
    .from('commission_events')
    .select('*')
    .eq('event_source', 'invoice')
    .eq('contact_id', 'VgOeEyKgYl9vAS8IcFLx'); // This is the location ID that was incorrectly stored
    
  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError);
    return;
  }
  
  console.log(`Found ${invoices?.length || 0} invoices with incorrect contact_id`);
  
  if (invoices && invoices.length > 0) {
    let updateCount = 0;
    
    for (const invoice of invoices) {
      // Get the correct contact ID from the raw invoice data
      const correctContactId = invoice.event_data?.raw_invoice?.contactDetails?.id;
      
      if (correctContactId) {
        console.log(`Updating invoice ${invoice.event_data?.invoice_number}: ${invoice.contact_id} -> ${correctContactId}`);
        
        const { error: updateError } = await supabase
          .from('commission_events')
          .update({ contact_id: correctContactId })
          .eq('id', invoice.id);
          
        if (updateError) {
          console.error(`Error updating invoice ${invoice.id}:`, updateError);
        } else {
          updateCount++;
        }
      } else {
        console.log(`Invoice ${invoice.event_data?.invoice_number} has no contact ID in raw data`);
      }
    }
    
    console.log(`\nSuccessfully updated ${updateCount} invoices`);
    
    // Verify the fix
    const { data: updatedInvoices } = await supabase
      .from('commission_events')
      .select('contact_id')
      .eq('event_source', 'invoice')
      .not('contact_id', 'is', null)
      .limit(10);
      
    const uniqueContactIds = [...new Set(updatedInvoices?.map(inv => inv.contact_id) || [])];
    console.log('\nUnique contact IDs after fix:', uniqueContactIds.slice(0, 5), '...');
  }
}

fixInvoiceContactIds().catch(console.error);