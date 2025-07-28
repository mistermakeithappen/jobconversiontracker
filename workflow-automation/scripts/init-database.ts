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

console.log('Connecting to Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndInitDatabase() {
  console.log('\n🔍 Checking database status...');
  
  // Check if users table exists
  const { data: tables, error: tablesError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (tablesError && tablesError.code === '42P01') {
    console.log('❌ Tables do not exist. Please run the migration first!');
    console.log('\nTo run the migration:');
    console.log('1. Go to: https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new');
    console.log('2. Copy the contents of: supabase/migrations/20250125_initial_schema.sql');
    console.log('3. Paste and run in the SQL editor');
    return;
  } else if (tablesError && tablesError.code !== 'PGRST116') {
    console.error('Error checking tables:', tablesError);
    return;
  }

  console.log('✅ Tables exist!');

  // Check for mock user
  const mockUserId = 'mock-user-123';
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', mockUserId)
    .single();

  if (userError && userError.code === 'PGRST116') {
    // User doesn't exist, create it
    console.log('\n👤 Creating mock user...');
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: mockUserId,
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
    } else {
      console.log('✅ Mock user created successfully!');
      console.log('User:', newUser);
    }
  } else if (!userError && existingUser) {
    console.log('\n✅ Mock user already exists');
    console.log('User:', existingUser);
  }

  // Check for workflows
  const { data: workflows, error: workflowsError } = await supabase
    .from('workflows')
    .select('id, name, created_at')
    .eq('user_id', mockUserId);

  if (!workflowsError) {
    console.log(`\n📋 Found ${workflows?.length || 0} workflows`);
    if (workflows && workflows.length > 0) {
      workflows.forEach(w => {
        console.log(`  - ${w.name} (created: ${new Date(w.created_at).toLocaleDateString()})`);
      });
    }
  }

  console.log('\n✨ Database initialization complete!');
}

checkAndInitDatabase().catch(console.error);