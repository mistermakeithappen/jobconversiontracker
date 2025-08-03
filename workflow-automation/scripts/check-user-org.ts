import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkUserOrg() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // The user ID from your session
  const userId = '2c760c74-f4ba-482c-a942-2198166b98e8';
  
  console.log('Checking organization for user:', userId);
  
  try {
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }
    
    console.log('\n✓ User found:', user);
    
    // Check organization membership
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select(`
        *,
        organizations (*)
      `)
      .eq('user_id', userId)
      .single();
    
    if (orgError) {
      console.error('\n❌ No organization membership found:', orgError);
      
      // Let's create the organization for this user
      console.log('\n📝 Creating organization for user...');
      
      // Create organization
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: user.email ? `${user.email}'s Organization` : 'My Organization',
          slug: `org-${userId.substring(0, 8)}`,
          subscription_status: 'active',
          subscription_plan: 'free'
        })
        .select()
        .single();
      
      if (createOrgError) {
        console.error('Failed to create organization:', createOrgError);
        return;
      }
      
      console.log('✓ Created organization:', newOrg);
      
      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: userId,
          role: 'owner',
          permissions: []
        });
      
      if (memberError) {
        console.error('Failed to add user to organization:', memberError);
        return;
      }
      
      console.log('✓ Added user as organization owner');
      
    } else {
      console.log('\n✓ Organization membership found:');
      console.log('Organization ID:', orgMember.organization_id);
      console.log('Role:', orgMember.role);
      console.log('Organization:', orgMember.organizations);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUserOrg();