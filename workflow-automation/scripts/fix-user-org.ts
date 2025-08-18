import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixUserOrganization() {
  try {
    const userId = '12518c46-1422-4321-851b-bd7b467b5dbc';
    const userEmail = '5mx5yymz9w@mkzaso.com';
    const fullName = 'Test User'; // We'll need to get this from somewhere
    const orgName = 'Test Organization'; // We'll need to get this from somewhere
    
    console.log('Fixing user organization for:', userId);
    
    // 1. Create user profile
    console.log('Creating user profile...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: userEmail,
        full_name: fullName,
      })
      .select('*')
      .single();
      
    if (userError) {
      console.error('Failed to create user profile:', userError);
      return;
    }
    
    console.log('User profile created:', user);
    
    // 2. Create organization
    console.log('Creating organization...');
    const orgSlug = `test-org-${Date.now().toString(36)}`;
    
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        subscription_status: 'trial',
        subscription_plan: 'free',
        created_by: userId,
        current_users: 1,
      })
      .select('*')
      .single();
      
    if (orgError) {
      console.error('Failed to create organization:', orgError);
      return;
    }
    
    console.log('Organization created:', org);
    
    // 3. Link user to organization
    console.log('Linking user to organization...');
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .select('*')
      .single();
      
    if (memberError) {
      console.error('Failed to link user to organization:', memberError);
      return;
    }
    
    console.log('User linked to organization:', member);
    console.log('✅ User organization setup completed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixUserOrganization();
