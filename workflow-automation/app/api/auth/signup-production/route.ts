import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  try {
    // Sign up the user
    const { data: authData, error: authError } = await supabaseAnonClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName,
        }
      }
    });

    if (authError) {
      console.error('Supabase auth.signUp error:', authError);
      return NextResponse.json(
        { error: authError.message || 'Failed to create user account.' },
        { status: authError.status || 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed - no user data returned.' },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;

    // Use the service_role client to perform administrative tasks
    const supabaseServiceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create user profile and organization
    const createResult = await createUserProfileAndOrganization(
      supabaseServiceClient, 
      newUserId, 
      email, 
      fullName, 
      organizationName
    );

    if (!createResult.success) {
      // Clean up the auth user if profile creation fails
      await supabaseServiceClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: createResult.error || 'Failed to create user profile. Please try again.' },
        { status: 500 }
      );
    }

    // Return a successful response
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: fullName,
      },
      session: authData.session,
      success: true,
      message: 'Account created successfully. You can now sign in.',
    });

  } catch (error: any) {
    console.error('Error in signup process:', error);
    return NextResponse.json(
      { error: 'An error occurred during account creation. Please try again.' },
      { status: 500 }
    );
  }
}

// Function to create user profile and organization
async function createUserProfileAndOrganization(
  supabaseServiceClient: any,
  userId: string,
  email: string,
  fullName: string,
  organizationName: string
) {
  try {
    // 1. Create the user profile in public.users
    const { error: userProfileError } = await supabaseServiceClient
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (userProfileError) {
      console.error('Failed to create user profile:', userProfileError);
      return { success: false, error: userProfileError.message };
    }

    // 2. Create the organization
    const orgSlug = generateSlug(organizationName);
    console.log('Creating organization with slug:', orgSlug);
    
    // Ensure slug is unique
    let finalSlug = orgSlug;
    let attempt = 1;
    while (attempt <= 5) { // Limit attempts to prevent infinite loop
      const { data: existingOrg, error: slugError } = await supabaseServiceClient
        .from('organizations')
        .select('id')
        .eq('slug', finalSlug)
        .single();

      if (slugError && slugError.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error checking slug uniqueness:', slugError);
        return { success: false, error: 'Failed to check organization slug uniqueness' };
      }
      
      if (!existingOrg) {
        break; // Slug is unique
      }
      
      // Slug exists, generate a new one
      finalSlug = `${orgSlug}-${Date.now().toString(36)}-${attempt}`;
      attempt++;
    }

    const { data: newOrg, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .insert({
        name: organizationName,
        slug: finalSlug,
        subscription_status: 'trial',
        subscription_plan: 'free',
        created_by: userId,
        current_users: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (orgError || !newOrg) {
      console.error('Organization creation failed:', orgError);
      return { success: false, error: orgError?.message || 'Failed to create organization' };
    }

    // 3. Link the user to the organization as an 'owner'
    const { error: memberError } = await supabaseServiceClient
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        custom_permissions: '{}',
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('Failed to link user to organization:', memberError);
      return { success: false, error: memberError.message };
    }

    console.log('User profile and organization created successfully');
    return { success: true };

  } catch (error: any) {
    console.error('Error in user profile and organization creation:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

// Helper to generate a URL-friendly slug from a name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}