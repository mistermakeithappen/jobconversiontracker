import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createMockUser() {
  console.log('👤 Creating mock user...\n');

  const mockUserId = 'mock-user-123';
  
  // Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('id', mockUserId)
    .single();

  if (existingUser) {
    console.log('✅ Mock user already exists!');
    console.log('User:', existingUser);
    return;
  }

  // Create the mock user with UUID
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      clerk_id: 'mock-clerk-id',
      email: 'dev@example.com',
      subscription_status: 'active',
      credits_remaining: 15000,
      credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating mock user:', createError);
    console.log('\nMake sure you have run the database migration first!');
    console.log('Run: npm run setup-db');
  } else {
    console.log('✅ Mock user created successfully!');
    console.log('User:', newUser);
    
    // Update the mock auth to use the actual UUID
    console.log('\n📝 Update your mock-auth.tsx with this user ID:', newUser.id);
  }
}

createMockUser().catch(console.error);