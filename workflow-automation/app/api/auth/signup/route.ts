import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase/client';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  console.log('Signup endpoint hit');
  try {
    const body = await request.json();
    console.log('Signup request body:', body);
    const { email, password, fullName, organizationName } = body;

    if (!email || !password || !fullName || !organizationName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // TODO: Implement real Supabase Auth
    // For now, we'll create a mock signup flow

    // In production:
    // 1. Create user with Supabase Auth
    // const { data: authData, error: authError } = await supabase.auth.signUp({
    //   email,
    //   password,
    //   options: {
    //     data: {
    //       full_name: fullName,
    //     }
    //   }
    // });

    // 2. Create user in users table
    // 3. Create organization
    // 4. Add user as organization owner

    // For development mock:
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // Allow signup in development or when explicitly enabled
    if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_AUTH === 'true') {
      const supabase = getServiceSupabase();
      let orgSlug = generateSlug(organizationName);
      
      // Check if slug already exists and make it unique if needed
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();
      
      if (existingOrg) {
        // Add a random suffix to make it unique
        orgSlug = `${orgSlug}-${Date.now().toString(36)}`;
      }

      try {
        console.log('Creating organization with slug:', orgSlug);
        
        // Create organization
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: organizationName,
            slug: orgSlug,
            subscription_status: 'trial',
            subscription_plan: 'free',
          })
          .select()
          .single();

        if (orgError) {
          console.error('Organization creation error:', orgError);
          throw orgError;
        }

        console.log('Organization created:', org.id);
        console.log('Creating user with email:', email);
        
        // Create user
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email,
            full_name: fullName,
          })
          .select()
          .single();

        if (userError || !newUser) {
          console.error('User creation error:', userError);
          // Clean up organization if user creation fails
          await supabase.from('organizations').delete().eq('id', org.id);
          throw userError || new Error('Failed to create user');
        }

        // Add user to organization as owner
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: org.id,
            user_id: newUser.id,
            role: 'owner',
            permissions: [],
          });

        if (memberError) {
          console.error('Organization member creation error:', memberError);
          // Clean up user and organization if member creation fails
          await supabase.from('users').delete().eq('id', newUser.id);
          await supabase.from('organizations').delete().eq('id', org.id);
          throw memberError;
        }

        // Set mock auth cookie
        cookies().set('mock-user-id', newUser.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });

        return NextResponse.json({
          user: {
            id: newUser.id,
            email,
            name: fullName,
          },
          organization: {
            id: org.id,
            name: organizationName,
            slug: orgSlug,
          },
          success: true,
        });
      } catch (dbError: any) {
        console.error('Database error during signup:', dbError);
        console.error('Error details:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        });
        
        let errorMessage = 'Failed to create account. Please try again.';
        
        // Provide more specific error messages
        if (dbError.code === '23505') {
          errorMessage = 'An account with this email already exists.';
        } else if (dbError.message?.includes('organization')) {
          errorMessage = 'Failed to create organization. Please try a different name.';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Signup is not available in production yet' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}