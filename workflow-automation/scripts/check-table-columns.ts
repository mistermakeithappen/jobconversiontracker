import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkTableColumns() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Checking database table structures...\n');

  // Check integrations table
  try {
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error checking integrations:', error);
    } else if (integration && integration.length > 0) {
      console.log('✓ Integrations table columns:', Object.keys(integration[0]));
    } else {
      console.log('✓ Integrations table exists but is empty');
    }
  } catch (e) {
    console.error('Failed to check integrations table:', e);
  }

  // Check user_api_keys table
  try {
    const { data: apiKey, error } = await supabase
      .from('user_api_keys')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error checking user_api_keys:', error);
    } else if (apiKey && apiKey.length > 0) {
      console.log('✓ user_api_keys table columns:', Object.keys(apiKey[0]));
    } else {
      console.log('✓ user_api_keys table exists but is empty');
    }
  } catch (e) {
    console.error('Failed to check user_api_keys table:', e);
  }
}

checkTableColumns();