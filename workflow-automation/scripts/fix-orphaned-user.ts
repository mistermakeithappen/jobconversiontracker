import { getServiceSupabase } from '../lib/supabase/client';

async function fixOrphanedUser() {
  const supabase = getServiceSupabase();
  
  // The orphaned user details from auth
  const authUserId = '4fe11a34-e95b-4cab-aa0f-12f14542568e';
  const email = 'burgan.brandon@gmail.com';
  const fullName = 'Brandon Burgan';
  const organizationName = 'Brandon Burgan Org'; // You can change this
  
  console.log('Fixing orphaned user:', email);
  
  try {
    // 1. Create user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email: email,
        full_name: fullName,
      })
      .select()
      .single();
    
    if (userError) {
      console.error('Error creating user:', userError);
      throw userError;
    }
    
    console.log('Created user record:', user);
    
    // 2. Create organization
    const orgSlug = 'brandon-burgan-org';
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        slug: orgSlug,
        subscription_status: 'trial',
        subscription_plan: 'free',
        created_by: authUserId,
      })
      .select()
      .single();
    
    if (orgError) {
      console.error('Error creating organization:', orgError);
      throw orgError;
    }
    
    console.log('Created organization:', org);
    
    // 3. Add user to organization as owner
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: authUserId,
        role: 'owner',
        custom_permissions: {},
        status: 'active',
        accepted_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (memberError) {
      console.error('Error creating membership:', memberError);
      throw memberError;
    }
    
    console.log('Created organization membership:', membership);
    
    // 4. Update organization user count
    await supabase
      .from('organizations')
      .update({ current_users: 1 })
      .eq('id', org.id);
    
    console.log('✅ Successfully fixed orphaned user!');
    console.log('You can now refresh your browser and the error should be gone.');
    
  } catch (error) {
    console.error('Failed to fix orphaned user:', error);
    process.exit(1);
  }
}

fixOrphanedUser();