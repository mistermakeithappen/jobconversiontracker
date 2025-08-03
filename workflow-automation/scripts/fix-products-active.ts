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
const integrationId = 'f6c7c1fd-442b-4298-be42-447aa078326d';

async function fixProductsActive() {
  console.log('Fixing product active status...\n');
  
  // Update all products to be active
  const { data, error } = await supabase
    .from('ghl_products')
    .update({ is_active: true })
    .eq('user_id', mockUserId)
    .eq('integration_id', integrationId)
    .select();
    
  if (error) {
    console.error('Error updating products:', error);
  } else {
    console.log(`Updated ${data?.length || 0} products to active status`);
  }
}

fixProductsActive().catch(console.error);