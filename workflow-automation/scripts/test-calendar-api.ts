import { createClient } from '@supabase/supabase-js';

async function testCalendarAPI() {
  // Create authenticated Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get a test user
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    console.error('No users found in database');
    return;
  }

  const userId = users[0].id;
  console.log('Testing with user:', userId);

  // Get user's auth session
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  
  if (!user) {
    console.error('User not found in auth');
    return;
  }

  // Generate access token for the user
  const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
    options: {
      redirectTo: 'http://localhost:3000'
    }
  });

  console.log('Testing calendar API endpoint...');
  
  // Test the endpoint with service role
  const response = await fetch('http://localhost:3000/api/ghl/calendars', {
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'X-User-Id': userId
    }
  });

  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Response data:', JSON.stringify(data, null, 2));
}

testCalendarAPI().catch(console.error);