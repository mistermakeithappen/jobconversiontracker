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

async function checkProducts() {
  console.log('Checking products in database...\n');
  
  const { data: products, error } = await supabase
    .from('ghl_products')
    .select('*')
    .eq('user_id', mockUserId)
    .eq('integration_id', integrationId)
    .order('name', { ascending: true });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${products?.length || 0} products in database`);
    if (products && products.length > 0) {
      console.log('\nFirst 5 products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i+1}. ${p.name}`);
        console.log(`   - Price: ${p.price || 'N/A'} ${p.currency}`);
        console.log(`   - Type: ${p.price_type}`);
        console.log(`   - Active: ${p.is_active}`);
        console.log(`   - GHL ID: ${p.ghl_product_id}`);
      });
    }
  }
}

checkProducts().catch(console.error);