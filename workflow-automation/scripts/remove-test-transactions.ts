import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mockUserId = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

async function removeTestTransactions() {
  console.log('Removing test transactions...\n');
  
  // Delete transactions with test payment IDs
  const { data, error } = await supabase
    .from('sales_transactions')
    .delete()
    .eq('user_id', mockUserId)
    .like('ghl_payment_id', 'pay-test-%')
    .select();
    
  if (error) {
    console.error('Error removing test transactions:', error);
  } else {
    console.log(`Removed ${data?.length || 0} test transactions`);
  }
}

removeTestTransactions().catch(console.error);