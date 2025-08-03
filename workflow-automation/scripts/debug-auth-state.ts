import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function debugAuthState() {
  // Create client like the frontend does
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  console.log('1. Checking client-side auth state...');
  
  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Session error:', error);
    return;
  }
  
  if (!session) {
    console.log('No active session found');
    return;
  }
  
  console.log('\nActive session found:');
  console.log('User ID:', session.user.id);
  console.log('Email:', session.user.email);
  console.log('Metadata:', session.user.user_metadata);
  console.log('Session expires:', new Date(session.expires_at! * 1000).toLocaleString());
  
  // Check if user exists in database
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('\n2. Checking database records...');
  
  const { data: dbUser } = await serviceSupabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
    
  console.log('DB User:', dbUser);
  
  const { data: orgMember } = await serviceSupabase
    .from('organization_members')
    .select(`
      *,
      organizations!inner(*)
    `)
    .eq('user_id', session.user.id)
    .single();
    
  console.log('\nOrganization membership:', orgMember);
  
  // Test the API endpoint
  console.log('\n3. Testing /api/auth/me-simple endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/auth/me-simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id }),
    });
    
    const data = await response.json();
    console.log('API Response:', data);
  } catch (err) {
    console.error('API call failed:', err);
  }
}

debugAuthState();