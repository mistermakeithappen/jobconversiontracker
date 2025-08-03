import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkUserData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = '2c760c74-f4ba-482c-a942-2198166b98e8';
  
  try {
    // Check auth user
    console.log('1. Checking auth user...');
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    console.log('Auth user:', {
      id: authData.user?.id,
      email: authData.user?.email,
      metadata: authData.user?.user_metadata
    });
    
    // Check users table
    console.log('\n2. Checking users table...');
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (dbError) {
      console.error('DB user error:', dbError);
    } else {
      console.log('DB user:', dbUser);
    }
    
    // Check what happens when we call me-simple
    console.log('\n3. Testing me-simple endpoint response...');
    const response = await fetch('http://localhost:3000/api/auth/me-simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      console.error('API error:', response.status, response.statusText);
      const errorData = await response.text();
      console.error('Error response:', errorData);
    } else {
      const data = await response.json();
      console.log('API response:', data);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUserData();