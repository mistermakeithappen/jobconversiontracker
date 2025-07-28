import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMockUser() {
  const mockUserId = 'mock-user-123';
  
  // Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', 'mock-clerk-id')
    .maybeSingle();

  console.log('Check for existing user:', { existingUser, checkError });

  if (!existingUser && !checkError) {
    // Insert mock user
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: mockUserId,
        clerk_id: 'mock-clerk-id',
        email: 'dev@example.com',
        subscription_status: 'active',
        credits_remaining: 15000,
        credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

    if (error) {
      console.error('Error creating mock user:', error.message || error);
      console.error('Full error object:', error);
      console.error('Details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Mock user created successfully!');
      console.log('User data:', data);
    }
  } else {
    console.log('Mock user already exists');
  }
}

setupMockUser();