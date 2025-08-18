import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper to generate a URL-friendly slug from a name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('Failed to parse request body:', parseError);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  
  const { email, password, fullName, organizationName } = body;

  if (!email || !password || !fullName || !organizationName) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
  }

  // Use the anon key to sign up the user
  const supabaseAnonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: authData, error: authError } = await supabaseAnonClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        // We pass the organization name here so it can be used if needed,
        // but we will primarily handle logic with the service client.
        organization_name: organizationName,
      }
    }
  });

  if (authError || !authData.user) {
    console.error('Supabase auth.signUp error:', authError);
    return NextResponse.json(
      { error: authError?.message || 'Failed to create user account.' },
      { status: authError?.status || 500 }
    );
  }

  const newUserId = authData.user.id;

  // IMPORTANT: Use the service_role client to perform administrative tasks
  // This client can bypass RLS policies.
  const supabaseServiceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Create the user profile in public.users
    const { error: userProfileError } = await supabaseServiceClient
      .from('users')
      .insert({
        id: newUserId,
        email: email,
        full_name: fullName,
      });

    if (userProfileError) throw userProfileError;

    // 2. Create the organization
    let orgSlug = generateSlug(organizationName);
    console.log('Creating organization with slug:', orgSlug);
    
    // Ensure slug is unique
    const { data: existingOrg, error: slugError } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (slugError && slugError.code !== 'PGRST116') { // Ignore "no rows" error
      throw slugError;
    }
    
    if (existingOrg) {
      orgSlug = `${orgSlug}-${Date.now().toString(36)}`;
      console.log('Slug already exists, using:', orgSlug);
    }

    console.log('Inserting organization:', {
      name: organizationName,
      slug: orgSlug,
      subscription_status: 'trial',
      subscription_plan: 'free',
      created_by: newUserId,
      current_users: 1
    });

    const { data: newOrg, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .insert({
        name: organizationName,
        slug: orgSlug,
        subscription_status: 'trial',
        subscription_plan: 'free',
        created_by: newUserId,
        current_users: 1, // Start with 1 user
      })
      .select('id')
      .single();

    if (orgError || !newOrg) {
      console.error('Organization creation failed:', orgError);
      throw orgError || new Error("Failed to create organization.");
    }
    
    console.log('Organization created successfully:', newOrg.id);

    // 3. Link the user to the organization as an 'owner'
    console.log('Linking user to organization:', {
      organization_id: newOrg.id,
      user_id: newUserId,
      role: 'owner',
      status: 'active'
    });

    const { error: memberError } = await supabaseServiceClient
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: newUserId,
        role: 'owner',
        status: 'active',
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Failed to link user to organization:', memberError);
      throw memberError;
    }
    
    console.log('User successfully linked to organization');

    // 4. Return a successful response
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: fullName,
      },
      session: authData.session,
      success: true,
      message: 'Account created successfully. Please check your email to confirm your account.',
    });

  } catch (error: any) {
    // If any step after auth fails, attempt to delete the auth user to prevent orphans
    console.error('Error in post-auth user setup:', error);
    await supabaseServiceClient.auth.admin.deleteUser(newUserId);
    console.error('Cleaned up orphaned auth user.');
    
    return NextResponse.json(
      { error: 'An error occurred during account setup. Please try again.' },
      { status: 500 }
    );
  }
}